import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/widget.js',
    format: 'iife',
    name: 'AIFurnitureWidget',
    sourcemap: false,
    globals: {
      window: 'window',
      document: 'document'
    }
  },
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs(),
    terser({
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
      format: {
        comments: false,
      }
    })
  ],
  external: []
};
