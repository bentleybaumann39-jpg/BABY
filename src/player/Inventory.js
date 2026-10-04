// Items, documents and tapes the player carries.
export const ITEMS = {
  key_front: { name: 'Front door key', desc: 'Brass. It was under the mat, like she said.' },
  key_maint: { name: "Custodian's key ring", desc: 'R. OSTLUND. A paper tag with a little red light bulb drawn on it. Dried blood on the bow.' },
  key_director: { name: "Director's keys", desc: 'A.M. — three keys on a ring. Office. Desk. Something smaller.' },
  key_gate: { name: 'Padlock key', desc: 'Tagged GATE in Morrow\'s handwriting.' },
  battery: { name: 'Battery', desc: 'D cell. [R] to swap into the flashlight.', stack: true },
  oscillator: { name: 'Calibration oscillator', desc: '1 kHz test tone unit. [Q] to switch on and throw. It will scream until something makes it stop.', stack: true },
  reel_dictation: { name: 'Reel: "Lock enrolment, A.M."', desc: 'Quarter-inch tape. Needs a reel-to-reel machine.' },
  floorplan: { name: 'Floor plan', desc: 'Folded from the directory board. See FLOOR PLAN tab.' },
  reel_s3: { name: 'Subject reel 3', desc: 'A small reel labelled in pencil.', reel: true },
  reel_s5: { name: 'Subject reel 5', desc: 'A small reel labelled in pencil.', reel: true },
  reel_s7: { name: 'Subject reel 7', desc: 'H. BRAUER. A small reel labelled in pencil.', reel: true },
  reel_s8: { name: 'Subject reel 8', desc: 'A small reel labelled in pencil.', reel: true },
  reel_s9: { name: 'Subject reel 9', desc: 'A small reel labelled in pencil.', reel: true },
  reel_s11: { name: 'Subject reel 11', desc: 'D. KEENE. The label is pressed so hard the pencil tore it.', reel: true },
  recorder: { name: 'Field recorder', desc: 'Your own cassette recorder. Hold [RMB] to raise; the needle shows how loud the room is. [LMB] while raised to record.' },
  flashlight: { name: 'Flashlight', desc: '[F] toggle. [R] swap battery.' },
};

export class Inventory {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.items = new Map();
    this.docs = [];      // ids in pickup order
    this.unread = new Set();
    this.tape = null;    // { id, label, quality }
    this.add('recorder', 1, true);
    this.add('flashlight', 1, true);
  }

  add(id, n = 1, silent = false) {
    this.items.set(id, (this.items.get(id) || 0) + n);
    if (!silent) this.game.ui?.notify(`${ITEMS[id]?.name || id}${n > 1 ? ' ×' + n : ''}`);
  }

  has(id) { return (this.items.get(id) || 0) > 0; }
  count(id) { return this.items.get(id) || 0; }
  remove(id, n = 1) {
    const c = this.count(id) - n;
    if (c <= 0) this.items.delete(id); else this.items.set(id, c);
  }

  addDoc(id) {
    if (this.docs.includes(id)) return false;
    this.docs.push(id);
    this.unread.add(id);
    return true;
  }

  reelCount() { return [...this.items.keys()].filter((k) => ITEMS[k]?.reel).length; }

  serialize() { return { items: [...this.items], docs: this.docs, tape: this.tape }; }
  deserialize(d) {
    this.reset();
    if (!d) return;
    this.items = new Map(d.items);
    this.docs = d.docs || [];
    this.unread = new Set();
    this.tape = d.tape || null;
  }
}
