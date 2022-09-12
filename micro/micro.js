const {
  str,
  digits,
  choice,
  between,
  sequenceOf,
  lazy,
} = require('../index.js');

const betweenBrackets = between(str('('), str(')'));

const numberParser = digits.map((value) => ({
  type: 'number',
  value: Number(value),
}));

const operatorParser = choice([str('+'), str('-'), str('*'), str('/')]);

const expr = lazy(() => choice([numberParser, operationParser]));

const operationParser = betweenBrackets(
  sequenceOf([operatorParser, str(' '), expr, str(' '), expr])
).map(([operator, _, left, __, right]) => ({
  type: 'operation',
  value: {
    operator,
    left,
    right,
  },
}));

const example = '(+ (* 10 2) (- (/ 50 3) 2))';

const result = expr.run(example);

console.log(result);
