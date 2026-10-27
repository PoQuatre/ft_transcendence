#include "game/protocol.hpp"

#include <span>

#include "game/protocol/schemas/common_generated.h"
#include "game/protocol/schemas/event_generated.h"
#include "game/protocol/schemas/packet_ids_generated.h"
#include "game/protocol/schemas/state_generated.h"
#include "game/protocol/schemas/sync_generated.h"

namespace {

constexpr std::size_t max_payload_bytes = 1024;
constexpr std::size_t max_input_frames = 12;

template <typename T>
inline bool verified(std::span<const std::uint8_t> payload)
{
    flatbuffers::Verifier verifier(payload.data(), payload.size());
    return verifier.VerifyBuffer<T>();
}

inline bool validate_entity(const game::protocol::EntityState *entity)
{
    return entity != nullptr
        && (entity->kind() == game::protocol::EntityKind::Tank
            || entity->kind() == game::protocol::EntityKind::Projectile
            || entity->kind() == game::protocol::EntityKind::Resource)
        && entity->position() != nullptr && entity->velocity() != nullptr;
}

inline bool validate_event_payload(
    std::uint8_t packet_id, std::span<const std::uint8_t> payload)
{
    switch (static_cast<game::protocol::EventPacketId>(packet_id)) {
    case game::protocol::EventPacketId::WorldReady:
        return verified<game::protocol::WorldReady>(payload);

    case game::protocol::EventPacketId::WorldResyncRequest: {
        if (!verified<game::protocol::WorldResyncRequest>(payload))
            return false;

        const auto reason
            = flatbuffers::GetRoot<game::protocol::WorldResyncRequest>(
                payload.data())
                  ->reason();
        return reason >= game::protocol::ResyncReason::MIN
            && reason <= game::protocol::ResyncReason::MAX;
    }

    case game::protocol::EventPacketId::Unknown:
        return false;
    }

    return false;
}

inline bool validate_state_payload(
    std::uint8_t packet_id, std::span<const std::uint8_t> payload)
{
    switch (static_cast<game::protocol::StatePacketId>(packet_id)) {
    case game::protocol::StatePacketId::PlayerInput: {
        if (!verified<game::protocol::PlayerInput>(payload))
            return false;

        const auto *input
            = flatbuffers::GetRoot<game::protocol::PlayerInput>(payload.data());
        return !input->frames()->empty()
            && input->frames()->size() <= max_input_frames;
    }

    case game::protocol::StatePacketId::WorldDelta: {
        if (!verified<game::protocol::WorldDelta>(payload))
            return false;

        const auto *upserts
            = flatbuffers::GetRoot<game::protocol::WorldDelta>(payload.data())
                  ->upserts();
        return upserts == nullptr
            || std::ranges::all_of(*upserts, validate_entity);
    }

    case game::protocol::StatePacketId::Unknown:
        return false;
    }

    return false;
}

inline bool validate_sync_payload(
    std::uint8_t packet_id, std::span<const std::uint8_t> payload)
{
    switch (static_cast<game::protocol::SyncPacketId>(packet_id)) {
    case game::protocol::SyncPacketId::WorldSnapshotChunk: {
        if (!verified<game::protocol::WorldSnapshotChunk>(payload))
            return false;

        const auto *chunk
            = flatbuffers::GetRoot<game::protocol::WorldSnapshotChunk>(
                payload.data());
        return chunk->chunk_count() > 0
            && chunk->chunk_index() < chunk->chunk_count()
            && std::ranges::all_of(*chunk->entities(), validate_entity);
    }

    case game::protocol::SyncPacketId::Unknown:
        return false;
    }

    return false;
}

inline bool validate_payload(game::protocol::Channel channel,
    std::uint8_t packet_id, std::span<const std::uint8_t> payload)
{
    if (payload.size() > max_payload_bytes)
        return false;

    switch (channel) {
    case game::protocol::Channel::Control:
        return false;
    case game::protocol::Channel::Event:
        return validate_event_payload(packet_id, payload);
    case game::protocol::Channel::State:
        return validate_state_payload(packet_id, payload);
    case game::protocol::Channel::Sync:
        return validate_sync_payload(packet_id, payload);
    }

    return false;
}

}

namespace game::protocol {

std::optional<Frame> parse_message(
    Channel channel, std::span<const std::uint8_t> message)
{
    const auto header_size = channel == Channel::Control ? 1U : 2U;
    if (message.size() < header_size)
        return std::nullopt;

    const auto frame = Frame {
        .channel = channel,
        .packet_id = message[0],
        .session_generation
        = channel == Channel::Control ? uint8_t { 0 } : message[1],
        .payload = message.subspan(header_size),
    };

    if (!validate_payload(channel, frame.packet_id, frame.payload))
        return std::nullopt;
    return frame;
}

}
