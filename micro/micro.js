const { str, digits, choice, between, sequenceOf, lazy } = require('../index.js');

const betweenBrackets = between(str('('), str(')'));

const numberParser = digits.map((value) => ({
	type: 'number',
	value: Number(value),
}));

const operatorParser = choice([str('+'), str('-'), str('*'), str('/')]);

const expr = lazy(() => choice([numberParser, operationParser]));

const operationParser = betweenBrackets(
	sequenceOf([operatorParser, str(' '), expr, str(' '), expr]),
).map(([operator, _, left, __, right]) => ({
	type: 'operation',
	value: {
		operator,
		left,
		right,
	},
}));

const evaluate = (node) => {
	if (node.type === 'number') {
		return node.value;
	}

	if (node.type === 'operation') {
		if (node.value.operator === '+') {
			return evaluate(node.value.left) + evaluate(node.value.right);
		}
		if (node.value.operator === '-') {
			return evaluate(node.value.left) - evaluate(node.value.right);
		}
		if (node.value.operator === '*') {
			return evaluate(node.value.left) * evaluate(node.value.right);
		}
		if (node.value.operator === '/') {
			return evaluate(node.value.left) / evaluate(node.value.right);
		}
	}
};

const program = '(+ (* 10 2) (- (/ 50 3) 2))';

const inerpreter = (program) => {
	const parseResult = expr.run(program);
	if (parseResult.isError) {
		throw new Error("Couldn't interpret program");
	}

	return evaluate(parseResult.result);
};

console.log(inerpreter(program));
