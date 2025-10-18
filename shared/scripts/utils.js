export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const once = (fn) => { let ran=false; return (...a)=>ran?undefined:(ran=true,fn(...a)); };
export const byId = (id, root=document) => root.getElementById(id);
