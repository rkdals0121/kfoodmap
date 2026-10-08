// A browser's "Translate this page" — what a phone set to Thai, Vietnamese
// or Arabic offers on a page in English — replaces every text node with
// <font><font>the translation</font></font>. React still holds the node it
// drew. Taking that node out, or putting something in front of it, throws
// ("not a child of this node"), and the whole app gave way to the error
// screen: two presses on a heart were enough. A change of its text changed
// nothing on the page, so a count or a "Clear (1)" stayed as it had been.
//
// What stands where a text node was is remembered here, and the three
// things React does to a text node are done to the stand-in instead: it is
// taken out, it is what something is put in front of, and when the text
// changes the node goes back in its place (to be translated again by the
// translator, which watches for new text). Imported first in main.jsx,
// after the polyfills.

const standIn = new WeakMap();

const reactDrew = (node) => Object.keys(node).some(key => key.startsWith('__react'));

// The child of `parent` that `node` now sits under, if it was moved into a
// wrapper rather than replaced.
function under(parent, node) {
  let top = node;
  while (top.parentNode && top.parentNode !== parent) top = top.parentNode;
  return top !== node && top.parentNode === parent && !reactDrew(top) ? top : null;
}

function remember(records) {
  const added = new Set();
  for (const record of records) {
    for (const node of record.addedNodes) if (node.nodeType === 1) added.add(node);
  }
  if (added.size === 0) return;
  const taken = new Set();
  for (const record of records) {
    for (const gone of record.removedNodes) {
      if (gone.nodeType !== 3 || gone.parentNode === record.target) continue;
      // Swapped in one step, or put beside the node before it was taken out.
      const stand = [...record.addedNodes, record.previousSibling, record.nextSibling]
        .find(node => node && added.has(node) && !taken.has(node) && node.parentNode === record.target && !reactDrew(node));
      if (!stand) continue;
      taken.add(stand);
      standIn.set(gone, stand);
    }
  }
}

if (typeof Node !== 'undefined' && typeof MutationObserver !== 'undefined' && typeof Text !== 'undefined') {
  const proto = Node.prototype;
  const { removeChild, insertBefore, appendChild, replaceChild } = proto;

  // A text node React puts somewhere again: nothing stands in for it now.
  const retire = (node) => {
    const stand = standIn.get(node);
    if (!stand) return;
    standIn.delete(node);
    // Put back beside its stand-in: the translator undoing its own work
    // ("Show original"), which takes the stand-in out itself.
    if (stand === node.nextSibling || stand === node.previousSibling) return;
    if (stand.parentNode && !stand.contains(node)) removeChild.call(stand.parentNode, stand);
  };

  proto.removeChild = function (child) {
    if (child && child.nodeType === 3 && child.parentNode !== this) {
      const known = standIn.get(child);
      standIn.delete(child);
      const stand = known && known.parentNode === this ? known : under(this, child);
      if (stand) removeChild.call(this, stand);
      return child;
    }
    return removeChild.call(this, child);
  };

  proto.insertBefore = function (node, before) {
    let place = before;
    if (before && before.nodeType === 3 && before.parentNode !== this) {
      const known = standIn.get(before);
      place = known && known.parentNode === this ? known : under(this, before);
    }
    const done = insertBefore.call(this, node, place);
    if (node && node.nodeType === 3) retire(node);
    return done;
  };

  proto.appendChild = function (node) {
    const done = appendChild.call(this, node);
    if (node && node.nodeType === 3) retire(node);
    return done;
  };

  const value = Object.getOwnPropertyDescriptor(proto, 'nodeValue');
  if (value?.get && value?.set) {
    Object.defineProperty(Text.prototype, 'nodeValue', {
      configurable: true,
      enumerable: true,
      get() { return value.get.call(this); },
      set(text) {
        value.set.call(this, text);
        const stand = standIn.get(this);
        if (!stand || stand.contains(this)) return;
        standIn.delete(this);
        if (stand.parentNode) replaceChild.call(stand.parentNode, this, stand);
      },
    });
  }

  try {
    new MutationObserver((records) => {
      try { remember(records); } catch { /* a page left untranslated is no worse than before */ }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* no document yet: nothing to watch */ }
}
