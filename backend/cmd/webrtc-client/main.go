// Command webrtc-client connects to the local WebRTC echo endpoint.
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	pion "github.com/pion/webrtc/v4"
)

const (
	defaultEndpoint = "https://localhost:8443/api/webrtc/offer"
	defaultCAFile   = "certs/rootCA.pem"
)

type connection struct {
	channel  *pion.DataChannel
	messages <-chan pion.DataChannelMessage
	peer     *pion.PeerConnection
}

func main() {
	endpoint := flag.String("endpoint", defaultEndpoint, "WebRTC SDP-offer endpoint")
	caFile := flag.String("ca", defaultCAFile, "PEM certificate authority for the endpoint")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	runErr := run(ctx, os.Stdin, os.Stdout, *endpoint, *caFile)
	stop()
	if runErr != nil {
		fmt.Fprintln(os.Stderr, "webrtc-client:", runErr)
		os.Exit(1)
	}
}

func run(ctx context.Context, input io.Reader, output io.Writer, endpoint, caFile string) error {
	httpClient, err := newHTTPClient(caFile)
	if err != nil {
		return err
	}
	connection, err := connect(ctx, httpClient, endpoint)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := connection.peer.Close(); closeErr != nil {
			fmt.Fprintln(os.Stderr, "close WebRTC connection:", closeErr)
		}
	}()

	if _, outputErr := fmt.Fprintln(output, "Connected. Type a message and press Enter; Ctrl-D exits."); outputErr != nil {
		return fmt.Errorf("write connection status: %w", outputErr)
	}
	scanner := bufio.NewScanner(input)
	scanner.Buffer(nil, 1<<20)
	for scanner.Scan() {
		if err := connection.channel.SendText(scanner.Text()); err != nil {
			return fmt.Errorf("send data-channel message: %w", err)
		}

		select {
		case message := <-connection.messages:
			if message.IsString {
				if _, outputErr := fmt.Fprintln(output, "echo:", string(message.Data)); outputErr != nil {
					return fmt.Errorf("write echoed message: %w", outputErr)
				}
			} else {
				if _, outputErr := fmt.Fprintf(output, "echo (binary): %x\n", message.Data); outputErr != nil {
					return fmt.Errorf("write echoed message: %w", outputErr)
				}
			}
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
			return errors.New("timed out waiting for echoed message")
		}
	}

	return scanner.Err()
}

func newHTTPClient(caFile string) (*http.Client, error) {
	//nolint:gosec // The CLI intentionally accepts a user-selected CA file.
	certificate, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("read CA certificate %q: %w", caFile, err)
	}

	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(certificate) {
		return nil, fmt.Errorf("parse CA certificate %q", caFile)
	}

	return &http.Client{
		Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots}},
	}, nil
}

func connect(ctx context.Context, httpClient *http.Client, endpoint string) (*connection, error) {
	peer, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}
	closePeer := true
	defer func() {
		if closePeer {
			closeErr := peer.Close()
			if closeErr != nil {
				slog.Debug("close incomplete WebRTC connection", "error", closeErr)
			}
		}
	}()

	channel, err := peer.CreateDataChannel("cli", nil)
	if err != nil {
		return nil, fmt.Errorf("create data channel: %w", err)
	}
	messages := make(chan pion.DataChannelMessage, 1)
	channel.OnMessage(func(message pion.DataChannelMessage) { messages <- message })
	opened := make(chan struct{})
	channel.OnOpen(func() { close(opened) })

	offer, err := peer.CreateOffer(nil)
	if err != nil {
		return nil, fmt.Errorf("create SDP offer: %w", err)
	}
	gatherComplete := pion.GatheringCompletePromise(peer)
	localDescriptionErr := peer.SetLocalDescription(offer)
	if localDescriptionErr != nil {
		return nil, fmt.Errorf("set local description: %w", localDescriptionErr)
	}
	<-gatherComplete

	body, err := json.Marshal(peer.LocalDescription())
	if err != nil {
		return nil, fmt.Errorf("encode SDP offer: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create offer request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("send SDP offer: %w", err)
	}
	defer func() {
		closeErr := response.Body.Close()
		if closeErr != nil {
			slog.Debug("close SDP-offer response", "error", closeErr)
		}
	}()
	if response.StatusCode != http.StatusOK {
		responseBody, readErr := io.ReadAll(io.LimitReader(response.Body, 4096))
		if readErr != nil {
			return nil, fmt.Errorf("read SDP-offer response: %w", readErr)
		}
		return nil, fmt.Errorf("SDP offer returned %s: %s", response.Status, responseBody)
	}

	var answer pion.SessionDescription
	if err := json.NewDecoder(response.Body).Decode(&answer); err != nil {
		return nil, fmt.Errorf("decode SDP answer: %w", err)
	}
	if err := peer.SetRemoteDescription(answer); err != nil {
		return nil, fmt.Errorf("set remote description: %w", err)
	}

	log.Print(answer)

	select {
	case <-opened:
		closePeer = false
		return &connection{channel: channel, messages: messages, peer: peer}, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(10 * time.Second):
		return nil, errors.New("timed out opening data channel")
	}
}
