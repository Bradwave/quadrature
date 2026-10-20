// Quadrature: Shared constants: world centre, grid sizes, ambiguity threshold, cell keys.
const CX = 5,
  CY = 5,
  NS = [4, 5, 8, 10, 16, 20, 25, 40, 50, 100],
  AMB = 0.05,
  TAU = Math.PI * 2;
const K = (i, j) => (i + 5000) * 20000 + (j + 5000);

export { CX, CY, NS, AMB, TAU, K };
