import postCss from 'rollup-plugin-postcss';
import postCssSimpleVars from 'postcss-simple-vars';
import postCssNested from 'postcss-nested';
import babel from 'rollup-plugin-babel';
import { name as name0, dependencies } from './package.json';

const name = name0.replace(/^@[A-Za-z0-9_-]+\//, '');

export default {
  input: 'src/index.js',
  output: [
    {
      format: 'cjs',
      file: `dist/${name}.common.js`
    },
    {
      format: 'es',
      file: `dist/${name}.module.js`
    }
  ],
  external: Object.keys(dependencies),
  plugins: [
    postCss({
      plugins: [
        postCssSimpleVars(),
        postCssNested()
      ]
    }),
    babel()
  ]
};