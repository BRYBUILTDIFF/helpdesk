function state(value, cursor) {
  return { value, cursor: Math.max(0, Math.min([...value].length, cursor)) };
}
// The emulator owns its command line; xterm reports navigation as escape sequences.
export function editTerminalInput(current, data) {
  const chars = [...current.value];
  const cursor = current.cursor;
  const wordLeft = () => {
    let next = cursor;
    while (next > 0 && /\s/.test(chars[next - 1])) next--;
    while (next > 0 && !/\s/.test(chars[next - 1])) next--;
    return next;
  };
  const wordRight = () => {
    let next = cursor;
    while (next < chars.length && !/\s/.test(chars[next])) next++;
    while (next < chars.length && /\s/.test(chars[next])) next++;
    return next;
  };
  if (/^\x1b(?:\[D|OD|\[1;2D)$/.test(data)) return state(current.value, cursor - 1);
  if (/^\x1b(?:\[C|OC|\[1;2C)$/.test(data)) return state(current.value, cursor + 1);
  if (/^\x1b(?:\[1;[35]D|b)$/.test(data)) return state(current.value, wordLeft());
  if (/^\x1b(?:\[1;[35]C|f)$/.test(data)) return state(current.value, wordRight());
  if (['\x1b[H','\x1bOH','\x1b[1~','\x1b[7~','\x01'].includes(data)) return state(current.value, 0);
  if (['\x1b[F','\x1bOF','\x1b[4~','\x1b[8~','\x05'].includes(data)) return state(current.value, chars.length);
  if (data === '\x7f' || data === '\b') {
    if (cursor > 0) chars.splice(cursor - 1, 1);
    return state(chars.join(''), cursor - 1);
  }
  if (data === '\x1b[3~') { chars.splice(cursor, 1); return state(chars.join(''), cursor); }
  if (data === '\x15') return state(chars.slice(cursor).join(''), 0);
  if (data === '\x0b') return state(chars.slice(0, cursor).join(''), cursor);
  if (data === '\x17') { const start = wordLeft(); chars.splice(start, cursor - start); return state(chars.join(''), start); }
  // Discard whole control sequences, rather than printing their trailing C/D characters.
  const text = data.replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|O.|.)/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  chars.splice(cursor, 0, ...text);
  return state(chars.join(''), cursor + [...text].length);
}

// Redraw from the input's beginning, including lines wrapped by narrow viewports.
export function redrawTerminalInput(prompt, previous, next, cols) {
  const promptLength = [...prompt].length;
  const row = offset => Math.floor((promptLength + offset) / cols);
  const column = offset => (promptLength + offset) % cols + 1;
  const up = count => count > 0 ? `\x1b[${count}A` : '';
  return '\r' + up(row(previous.cursor) - row(0)) + `\x1b[${column(0)}G\x1b[J` + next.value + ' ' + '\r' +
    up(row([...next.value].length) - row(next.cursor)) + `\x1b[${column(next.cursor)}G`;
}
