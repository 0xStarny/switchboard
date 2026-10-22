# Switchboard

An unofficial, open-source Telegram web client for people who live in hundreds of
groups. It runs entirely in the browser and installs as a desktop app (PWA).

- **Workspaces without limits.** Group chats by client, project or community, with
  folders inside each workspace and automatic rules ("name contains Halden").
- **One list of what is waiting.** "To handle" shows only unread chats that need
  you, sorted: mentions and DMs first, then by workspace. Muted noise stays folded.
- **Bulk actions.** Select 40 groups and mark read, mute, archive, tag, snooze or
  move them in one go. Telegram calls are queued to respect rate limits.
- **Follow-ups and reminders.** Send a message later (Telegram holds it and sends it
  on time, even with the app closed), optionally withdrawn if they reply first. Or ask
  to see a chat again in 3 days, with a note, "only if nobody answered".
- **Tags, priorities, private notes, snooze.** Low-priority chats leave the inbox
  unless someone mentions you.
- **Keyboard first.** `Ctrl K` to jump anywhere, `J`/`K` to move, `E` to mark read
  and go to the next chat.

## Privacy

There is no Switchboard server. The app talks to Telegram directly over MTProto
(via [GramJS](https://github.com/gram-js/gramjs)) from your browser. Your session
lives in `localStorage`; workspaces, tags and notes live in `localStorage` too and
never reach Telegram or anyone else. Export them from Settings to move them.
Tick "Keep nothing from my account on this computer" at sign-in to hold all of it in
the tab only: closing it erases the session and your sorting.

Follow-ups are cancelled by the app when it sees a reply, so it must be open at least
once between the reply and the send time. Reminders only alert while the app is open;
due ones wait at the top of "To handle".

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:8790
```

`VITE_TG_API_ID` and `VITE_TG_API_HASH` come from <https://my.telegram.org> >
API development tools. They identify the **app**, not a user: every visitor signs
in with their own Telegram account. Without them, the app asks for a key on first
launch and keeps it in that browser, which is handy for self-hosting.

Try it without an account at `/#demo`.

## Deploy

It is a static site. On Vercel, import the repo (settings come from `vercel.json`)
and add `VITE_TG_API_ID` and `VITE_TG_API_HASH` as environment variables. Netlify or
any static host works the same way: build command `npm run build`, output `dist`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F0xStarny%2Fswitchboard&env=VITE_TG_API_ID,VITE_TG_API_HASH&envDescription=Telegram%20app%20key%20from%20my.telegram.org&envLink=https%3A%2F%2Fmy.telegram.org%2Fapps)

## Not yet

Voice and video calls, stickers picker, sending files, reactions, editing and
deleting messages, secret chats. Telegram Premium features stay Premium: this app
only adds organisation on top.

## License

MIT. Switchboard is not affiliated with Telegram.
