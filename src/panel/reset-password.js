// Komenda „easycopy reset-password” – nowe hasło do panelu, gdy stare zostało zapomniane.

import path from 'node:path';
import { parseArgs } from 'node:util';

import { hashPassword, randomPassword, validatePassword } from './accounts.js';
import { openDatabase } from './db.js';

export const RESET_HELP = `Użycie:
  easycopy reset-password [login] [--password <nowe hasło>]

Ustawia nowe hasło do panelu i wylogowuje wszystkie urządzenia. Bez --password
generuje losowe hasło i wypisuje je na ekranie. Bez loginu – jedyne konto w panelu.

W Dockerze:
  docker compose exec easycopy easycopy reset-password
`;

export async function runResetPassword(argv) {
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
    console.log(RESET_HELP);
    return;
  }

  const dataDir = path.resolve(o['data-dir'] ?? process.env.DATA_DIR ?? 'data');
  const db = openDatabase(path.join(dataDir, 'easycopy.db'));
  try {
    const users = db.listUsers();
    if (!users.length) {
      console.log('W panelu nie ma jeszcze kont – otwórz panel w przeglądarce i utwórz konto administratora.');
      return;
    }
    let user;
    if (positionals[0]) {
      user = db.getUserByName(positionals[0]);
      if (!user) throw new Error(`Nie ma konta „${positionals[0]}”. Konta: ${users.map((u) => u.username).join(', ')}`);
    } else if (users.length === 1) {
      user = db.getUser(users[0].id);
    } else {
      throw new Error(`Podaj login. Konta: ${users.map((u) => u.username).join(', ')}`);
    }

    const password = o.password ?? randomPassword();
    const problem = validatePassword(password);
    if (problem) throw new Error(problem);
    db.setPassword(user.id, await hashPassword(password));

    console.log(`Nowe hasło dla „${user.username}” zostało ustawione. Wszystkie urządzenia zostały wylogowane.`);
    if (!o.password) console.log(`Hasło: ${password}\nZmień je po zalogowaniu w zakładce Konto.`);
  } finally {
    db.close();
  }
}
