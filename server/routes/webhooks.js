import { Router } from 'express';
import { LINEWebhook } from '../webhooks/line.js';
import { WhatsAppWebhook } from '../webhooks/whatsapp.js';
import { MessengerWebhook } from '../webhooks/messenger.js';

const router = Router();
const lineWebhook = new LINEWebhook();
const whatsappWebhook = new WhatsAppWebhook();
const messengerWebhook = new MessengerWebhook();

// LINE webhook
router.post('/line', (req, res) => lineWebhook.handleWebhook(req, res));

// WhatsApp webhooks
router.get('/whatsapp', (req, res) => whatsappWebhook.handleVerification(req, res));
router.post('/whatsapp', (req, res) => whatsappWebhook.handleWebhook(req, res));

// Messenger webhooks
router.get('/messenger', (req, res) => messengerWebhook.handleVerification(req, res));
router.post('/messenger', (req, res) => messengerWebhook.handleWebhook(req, res));

export default router;
