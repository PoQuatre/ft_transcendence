vault {
	address = "http://vault:8200"
}

auto_auth {
	method {
		type = "approle"

		config = {
			role_id_file_path                  = "/vault/file/nginx-pki-role-id"
			secret_id_file_path                = "/credentials/secret_id"
			remove_secret_id_file_after_reading = false
		}
	}
}

template_config {
	exit_on_retry_failure = true
}

template {
	destination          = "/run/nginx-tls/.nginx-agent.pem"
	perms                = "0600"
	error_on_missing_key = true
	command              = "/usr/local/bin/install-nginx-pki"

	contents = <<EOF
{{- $hostName := env "HOST_NAME" -}}
{{- with pkiCert "pki/issue/nginx" "common_name=localhost" (printf "alt_names=nginx,%s" $hostName) "ip_sans=127.0.0.1,::1" -}}
{{ .Cert }}{{ .CA }}
__NGINX_PKI_KEY__
{{ .Key }}
{{- end -}}
EOF
}
