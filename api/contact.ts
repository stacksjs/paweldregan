// Contact form endpoint — POST /api/contact.
//
// NOT WIRED UP YET. The paweldregan.com deploy is static (S3+CloudFront
// via @stacksjs/ts-cloud) and has no runtime. Until issue #7 (mail-os
// on EC2 + hello@paweldregan.com mailbox) lands, the form's POST will
// fail with a network error and the UI falls back to the IG link.
//
// Deployment plan once #7 is up:
//   - Host this on the same EC2 box that runs mail-os, behind nginx
//     listening on 443 for api.paweldregan.com (or proxied through
//     CloudFront so /api/contact stays same-origin).
//   - Inject SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS env vars
//     pointing at the local mail-os spool. From hello@paweldregan.com.
//   - Front it with the in-process rate limiter below; for production,
//     replace with Redis or whatever the rest of the EC2 stack uses.

import { createTransport, type SendMailOptions } from 'nodemailer'

interface ContactPayload {
  name: string
  email: string
  message: string
}

const RATE_LIMIT_MS = 60_000
const recentByIp = new Map<string, number>()

const TO_ADDRESS = 'hello@paweldregan.com'
const FROM_ADDRESS = 'hello@paweldregan.com'

function isValid(p: Partial<ContactPayload>): p is ContactPayload {
  if (!p.name || !p.email || !p.message) return false
  if (p.name.length > 200 || p.email.length > 320 || p.message.length > 5000) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)
}

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

const transporter = createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 25),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

export async function handleContact(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const ip = clientIp(req)
  const last = recentByIp.get(ip) ?? 0
  if (Date.now() - last < RATE_LIMIT_MS) return new Response('rate limited', { status: 429 })

  let body: Partial<ContactPayload>
  try { body = await req.json() } catch { return new Response('bad json', { status: 400 }) }
  if (!isValid(body)) return new Response('invalid payload', { status: 400 })

  const mail: SendMailOptions = {
    from: FROM_ADDRESS,
    to: TO_ADDRESS,
    replyTo: `${body.name} <${body.email}>`,
    subject: `Contact form — ${body.name}`,
    text: `From: ${body.name} <${body.email}>\n\n${body.message}`,
  }

  try {
    await transporter.sendMail(mail)
  } catch (err) {
    console.error('contact: send failed', err)
    return new Response('send failed', { status: 502 })
  }

  recentByIp.set(ip, Date.now())
  return new Response('ok', { status: 200 })
}
