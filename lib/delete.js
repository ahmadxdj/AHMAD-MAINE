// lib/delete.js
import {
    proto,
    generateMessageIDV2,
    encodeWAMessage,
    areJidsSameUser
} from '@whiskeysockets/baileys';

// ============================================================
// Delete a group status (works for self & others)
// ============================================================
export async function deleteGroupStatus(conn, from, targetId, targetParticipant) {
    if (!targetId || !targetParticipant) {
        throw new Error('Missing targetId or targetParticipant');
    }

    const senderIdentity = conn.user.lid
        || (conn.user.id.split(':')[0] + '@s.whatsapp.net');

    const isOwnStatus = areJidsSameUser(targetParticipant, senderIdentity);

    const keyToDelete = {
        remoteJid: from,
        fromMe: isOwnStatus,
        id: targetId,
        participant: targetParticipant
    };

    const messageContent = {
        protocolMessage: {
            key: keyToDelete,
            type: proto.Message.ProtocolMessage.Type.REVOKE
        }
    };

    const skdm = await conn.signalRepository.getSenderKeyDistributionMessage({
        group: from,
        meId: senderIdentity
    });

    const fullMessage = {
        ...messageContent,
        senderKeyDistributionMessage: {
            groupId: from,
            axolotlSenderKeyDistributionMessage: skdm
        }
    };

    const bytes = encodeWAMessage(fullMessage);
    const { ciphertext } = await conn.signalRepository.encryptGroupMessage({
        group: from,
        data: bytes,
        meId: senderIdentity
    });

    const editAttr = isOwnStatus ? '7' : '8';

    const stanza = {
        tag: 'message',
        attrs: {
            id: generateMessageIDV2(senderIdentity),
            to: from,
            type: 'text',
            edit: editAttr,
            addressing_mode: 'lid'
        },
        content: [
            { tag: 'enc', attrs: { v: '2', type: 'skmsg' }, content: ciphertext },
            { tag: 'meta', attrs: { is_group_status: 'true' } }
        ]
    };

    const result = await conn.query(stanza);
    if (result?.attrs?.error) {
        throw new Error(`WhatsApp Error: ${result.attrs.error}`);
    }
    return true;
}
