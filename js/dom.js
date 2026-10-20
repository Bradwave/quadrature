// Quadrature: Tiny DOM helpers.
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];

export { $, $$ };
