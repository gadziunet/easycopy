// The "easycopy reset-password" command – a new panel password when the old one is forgotten.

import path from 'node:path';
import { parseArgs } from 'node:util';

import { hashPassword, randomPassword, validatePassword } from './accounts.js';
import { openDatabase } from './db.js';
import { cliLanguage, translator } from '../shared/i18n.js';

export async function runResetPassword(argv) {
  const t = translator(cliLanguage());
  const { values: o, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      password: { type: 'string' },
      'data-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (o.help) {
    console.log(t('cli.resetHelp'));
    return;
  }

  const dataDir = path.resolve(o['data-dir'] ?? process.env.DATA_DIR ?? 'data');
  const db = openDatabase(path.join(dataDir, 'easycopy.db'));
  try {
    const users = db.listUsers();
    if (!users.length) {
      console.log(t('cli.noAccounts'));
      return;
    }
    let user;
    if (positionals[0]) {
      user = db.getUserByName(positionals[0]);
      if (!user) throw new Error(t('cli.noSuchAccount', { name: positionals[0], list: users.map((u) => u.username).join(', ') }));
    } else if (users.length === 1) {
      user = db.getUser(users[0].id);
    } else {
      throw new Error(t('cli.giveUsername', { list: users.map((u) => u.username).join(', ') }));
    }

    const password = o.password ?? randomPassword();
    const problem = validatePassword(password);
    if (problem) throw new Error(t(problem.key ?? problem, problem.params ?? {}));
    db.setPassword(user.id, await hashPassword(password));

    console.log(t('cli.passwordSet', { name: user.username }));
    if (!o.password) console.log(t('cli.passwordShown', { password }));
  } finally {
    db.close();
  }
}
