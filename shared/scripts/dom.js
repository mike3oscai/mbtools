export const h = (tag, props={}, ...children) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) el.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return el;
};
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
