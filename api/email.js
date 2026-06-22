import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'beerightcommunications@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendWelcomeEmail({ email, name }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  await transporter.sendMail({
    from: '"Matt | Metaphor Builder" <beerightcommunications@gmail.com>',
    to: email,
    subject: 'Welcome to Metaphor Builder 🐝',
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; color: #1C1A14; box-sizing: border-box; width: 100%;">
        <div style="background: #5C2D7A; padding: 2rem; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 1.6rem; margin: 0;">Metaphor Builder</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 0.5rem 0 0;">by Bee Right Communications</p>
        </div>
        <div style="background: #FDFAF4; padding: 2rem; border-radius: 0 0 12px 12px; border: 1px solid #e8e0d0;">
          <p style="font-size: 1.1rem;">Hi ${firstName},</p>
          <p>Welcome — I'm genuinely glad you're here.</p>
          <p>Metaphor Builder was built by a practising hypnotherapist (me) because I kept hitting the same wall in session — the right metaphor was there somewhere, but finding it under pressure was another story.</p>
          <p>Your free trial includes:</p>
          <ul style="line-height: 1.8;">
            <li><strong>2 Quick Mode generations</strong> — for in-session use, 3 fields, ready in seconds</li>
            <li><strong>1 Full Mode generation</strong> — for deeper pre or post-session prep</li>
          </ul>
          <p>The more specific you are about your client's world — their hobbies, job, interests, language — the more personalised and powerful the metaphor.</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="https://metaphorbuilder.app" style="background: #F26B1D; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.95rem; display: inline-block; mso-padding-alt: 0;">Start building metaphors →</a>
          </div>
          <p>If you have any questions or run into anything, just reply to this email — it comes straight to me.</p>
          <p style="margin-top: 2rem;">Matt<br>
          <span style="color: #888; font-size: 0.9rem;">Metaphor Builder · Bee Right Communications</span></p>
        </div>
      </div>
    `,
  });
}

export async function sendTrialExhaustedEmail({ email, name }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  await transporter.sendMail({
    from: '"Matt | Metaphor Builder" <beerightcommunications@gmail.com>',
    to: email,
    subject: "You've used your free trial — here's what's next",
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; color: #1C1A14; box-sizing: border-box; width: 100%;">
        <div style="background: #5C2D7A; padding: 2rem; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 1.6rem; margin: 0;">Metaphor Builder</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 0.5rem 0 0;">by Bee Right Communications</p>
        </div>
        <div style="background: #FDFAF4; padding: 2rem; border-radius: 0 0 12px 12px; border: 1px solid #e8e0d0;">
          <p style="font-size: 1.1rem;">Hi ${firstName},</p>
          <p>You've used your free trial generations — which means you've seen what Metaphor Builder can do.</p>
          <p>If those metaphors felt more personalised than what you'd normally reach for under pressure, that's the point.</p>
          <p>To keep building, you can subscribe from as little as <strong>A$8.99/month</strong>. That's less than the cost of a single session hour, and it's there every time you need it.</p>
          <div style="background: #f3eaf9; border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0;">
            <p style="margin: 0 0 0.5rem; font-weight: bold; color: #5C2D7A;">Choose your plan:</p>
            <p style="margin: 0.25rem 0;">📅 <strong>Monthly</strong> — A$8.99/month, cancel anytime</p>
            <p style="margin: 0.25rem 0;">📆 <strong>Annual</strong> — A$69/year, save 36%</p>
            <p style="margin: 0.25rem 0;">♾️ <strong>Lifetime</strong> — A$197 once, unlimited forever</p>
          </div>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="https://metaphorbuilder.app" style="background: #F26B1D; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.95rem; display: inline-block; mso-padding-alt: 0;">Subscribe now →</a>
          </div>
          <p>If you have any questions or want to talk through whether it's right for you, just reply — I'm happy to chat.</p>
          <p style="margin-top: 2rem;">Matt<br>
          <span style="color: #888; font-size: 0.9rem;">Metaphor Builder · Bee Right Communications</span></p>
        </div>
      </div>
    `,
  });
}
