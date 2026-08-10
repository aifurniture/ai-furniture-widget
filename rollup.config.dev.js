import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

/** Unminified build to surface real TDZ variable names */
export default {
  input: 'src/index.js',
  output: {
    file: 'dist/widget.dev.js',
    format: 'iife',
    name: 'AIFurnitureWidget',
    sourcemap: true,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
  ],
};
