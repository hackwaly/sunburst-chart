import resolve from 'rollup-plugin-node-resolve';
import commonJs from 'rollup-plugin-commonjs';
import postCss from 'rollup-plugin-postcss';
import postCssSimpleVars from 'postcss-simple-vars';
import postCssNested from 'postcss-nested';
import babel from 'rollup-plugin-babel';
import { name as name0, homepage, version } from './package.json';

const name = name0.replace(/^@[A-Za-z0-9_-]+\//, '');

export default {
  input: 'src/index.js',
  output: [
    {
      format: 'umd',
      name: 'Sunburst',
      file: `dist/${name}.js`,
      sourcemap: true,
      banner: `// Version ${version} ${name} - ${homepage}`
    }
  ],
  plugins: [
    postCss({
      plugins: [
        postCssSimpleVars(),
        postCssNested()
      ]
    }),
    resolve(),
    commonJs(),
    babel({ exclude: 'node_modules/**' })
  ]
};