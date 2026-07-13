export function parseCliArgs(argv, definitions) {
  const values = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }
    const [rawName, inlineValue] = argument.slice(2).split('=', 2);
    const definition = definitions[rawName];
    if (definition === undefined) {
      throw new Error(`Unknown option --${rawName}`);
    }
    if (definition.type === 'boolean') {
      values[definition.name ?? rawName] = inlineValue === undefined
        ? true
        : inlineValue !== 'false';
      continue;
    }
    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Option --${rawName} requires a value`);
    }
    if (inlineValue === undefined) index += 1;
    values[definition.name ?? rawName] = value;
  }
  return { values, positionals };
}

export function requiredOption(values, name) {
  const value = values[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required option --${name.replaceAll('_', '-')}`);
  }
  return value.trim();
}

export function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function usageError(message, usage) {
  const error = new Error(`${message}\n\n${usage}`);
  error.exitCode = 2;
  return error;
}
