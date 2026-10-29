# ssh.town

A multiplayer town game you play over SSH, right in your terminal.

ssh.town is part MUD, part tiny virtual world. Walk around ASCII maps, level up, earn money, chat with other players, and step inside buildings to interact with the game.

```bash
ssh -p 34567 2a01:4f9:3080:3192::2144
```

## Features

- **Multiplayer movement** through shared ASCII maps
- **Real-time chat** with everyone in the town
- **Enterable buildings**, including multi-floor ones, plus doors and portals
- **Progression** with levels, stats, and money
- **Accounts** with registration and login
- **Persistent storage** so your character is there when you come back
- **Full color** rendering and a **window system** that works entirely over SSH

## Getting started

### Connecting

You can either SSH in directly to the server (hosted with Hack Club Nest) or you can use the web demo (which connects to the server itself).

#### SSH

`2a01:4f9:3080:3192::2144` is my Hack Club's Nest container's IPv6.
`34567` is my free port.

```bash
ssh -p 34567 2a01:4f9:3080:3192::2144
```

#### Web demo

Navigate to `ssh.simon312.hackclub.app`

### Running the server locally

```bash
npm run server
```

> NOTE: You might have to regenerate the SSH keys in the keys folder.

Or run it directly:

```bash
node src/main.js
```

The server listens on port **2222** by default.

### Connecting locally

```bash
ssh -p 2222 localhost
```

Replace `localhost` with the server's hostname or IP to connect to a remote instance. On first connect, you'll be prompted to register an account.

## Controls

| Key     | Action                                  |
|---------|-----------------------------------------|
| `W` `A` `S` `D` | Move around                     |
| `Enter` | Enter a door, portal, or building       |
| `T`     | Open chat                               |
| `L`     | Logout                                  |

## Next steps

- [ ] NPCs with dialogue
- [ ] Quests that reward XP
- [ ] Abilities based on stats
- [ ] Full HP, XP, level, and mana systems
- [ ] More immersive content
- [ ] Working shops

More to come!