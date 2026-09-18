// Uniform grid over the lane for cheap neighbour and target queries.
export class SpatialGrid {
  constructor(minX, maxX, minY, maxY, cell = 2) {
    this.minX = minX; this.minY = minY; this.cell = cell;
    this.cols = Math.ceil((maxX - minX) / cell) + 1;
    this.rows = Math.ceil((maxY - minY) / cell) + 1;
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }
  clear() { for (const b of this.buckets) b.length = 0; }
  cx(x) { return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / this.cell))); }
  cy(y) { return Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.minY) / this.cell))); }
  insert(u) { this.buckets[this.cy(u.y) * this.cols + this.cx(u.x)].push(u); }
  // Calls fn(u) for every unit whose cell intersects the box around (x,y) with radius r.
  each(x, y, r, fn) {
    const x0 = this.cx(x - r), x1 = this.cx(x + r), y0 = this.cy(y - r), y1 = this.cy(y + r);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const b = this.buckets[cy * this.cols + cx];
      for (let i = 0; i < b.length; i++) fn(b[i]);
    }
  }
}
