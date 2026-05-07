#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

// ─── Minimal schema ────────────────────────────────────────────────────────────
// Mirrors src/user/schemas/user.schema.ts just enough to read and write the
// fields we care about without pulling in the full NestJS module graph.
const UserSchema = new mongoose.Schema(
  {
    authProviderId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String, default: '' },
    globalRole: {
      type: String,
      enum: ['none', 'super_admin'],
      default: 'none',
    },
  },
  { strict: false },
);

const User = mongoose.model('User', UserSchema);

// ─── CLI argument parser ────────────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--email':   parsed.email  = argv[++i]; break;
      case '--auth-id': parsed.authId = argv[++i]; break;
      case '--name':    parsed.name   = argv[++i]; break;
      case '--help':    parsed.help   = true;       break;
    }
  }
  return parsed;
}

function printUsage() {
  console.log(`
Usage: npm run create-superuser -- [options]

Options:
  --email <email>       (required) Email of the user to promote or create
  --auth-id <subject>   Auth0 subject ID (e.g. auth0|abc123). Required only
                        when creating a user who hasn't logged in yet.
  --name <name>         Display name. Used only when creating a new user.
  --help                Show this message

Examples:
  # Promote a user who has already logged in via the app:
  npm run create-superuser -- --email alice@example.com

  # Create a superuser record before they log in for the first time:
  npm run create-superuser -- --email alice@example.com --auth-id auth0|64abc123 --name "Alice"
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.email) {
    console.error('Error: --email is required.\n');
    printUsage();
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set. Make sure .env exists and contains MONGODB_URI.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  try {
    const existing = await User.findOne({ email: args.email });

    if (existing) {
      const previousRole = existing.globalRole;
      if (previousRole === 'super_admin') {
        console.log(`"${existing.name}" (${args.email}) is already a superuser. No changes made.`);
      } else {
        existing.globalRole = 'super_admin';
        await existing.save();
        console.log(`Promoted "${existing.name}" (${args.email}) from "${previousRole}" to "super_admin".`);
      }
      return;
    }

    // User not found — create them if --auth-id was supplied
    if (!args.authId) {
      console.error(`No user found with email "${args.email}".`);
      console.error(
        'If the user has not logged in yet, supply their Auth0 subject with --auth-id <subject>.\n' +
        'You can find the subject in the Auth0 dashboard under Users → <user> → user_id.',
      );
      process.exit(1);
    }

    const created = await User.create({
      authProviderId: args.authId,
      email: args.email,
      name: args.name || args.email,
      picture: '',
      globalRole: 'super_admin',
    });

    console.log(`Created superuser "${created.name}" (${args.email}) with auth ID "${args.authId}".`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
