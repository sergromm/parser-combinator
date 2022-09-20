const {
	Parser,
	updateParserError,
	updateParserState,
	sequenceOf,
	succeed,
	fail,
} = require('./lib');
const fs = require('fs');
const path = require('path');

const Bit = new Parser((parserState) => {
	if (parserState.isError) {
		return parserState;
	}

	const byteOffset = Math.floor(parserState.index / 8);

	if (byteOffset >= parserState.target.byteLength) {
		return updateParserError(parserState, `Bit: Unexpected end of input`);
	}

	const byte = parserState.target.getUint8(byteOffset);
	const bitOffset = 7 - (parserState.index % 8);

	const result = (byte & (1 << bitOffset)) >> bitOffset;
	return updateParserState(parserState, parserState.index + 1, result);
});

const Zero = new Parser((parserState) => {
	if (parserState.isError) {
		return parserState;
	}

	const byteOffset = Math.floor(parserState.index / 8);

	if (byteOffset >= parserState.target.byteLength) {
		return updateParserError(parserState, `Zero: Unexpected end of input`);
	}

	const byte = parserState.target.getUint8(byteOffset);
	const bitOffset = 7 - (parserState.index % 8);

	const result = (byte & (1 << bitOffset)) >> bitOffset;

	if (result !== 0) {
		return updateParserError(
			parserState,
			`Zero: Expected a 0 but got 1 @ index ${parserState.index}`,
		);
	}
	return updateParserState(parserState, parserState.index + 1, result);
});

const One = new Parser((parserState) => {
	if (parserState.isError) {
		return parserState;
	}

	const byteOffset = Math.floor(parserState.index / 8);

	if (byteOffset >= parserState.target.byteLength) {
		return updateParserError(parserState, `One: Unexpected end of input`);
	}

	const byte = parserState.target.getUint8(byteOffset);
	const bitOffset = 7 - (parserState.index % 8);

	const result = (byte & (1 << bitOffset)) >> bitOffset;

	if (result !== 1) {
		return updateParserError(
			parserState,
			`One: Expected a 0 but got 1 @ index ${parserState.index}`,
		);
	}
	return updateParserState(parserState, parserState.index + 1, result);
});

const Uint = (n) => {
	if (n < 1) {
		throw new Error(`Uint: n must be larger than 0, but we got ${n}`);
	}

	if (n > 32) {
		throw new Error(`Uint: n must be less than 32, but we got ${n}`);
	}

	return sequenceOf(Array.from({ length: n }, () => Bit)).map((bits) => {
		return bits.reduce((acc, bit, i) => {
			return acc + Number(BigInt(bit) << BigInt(n - 1 - i));
		}, 0);
	});
};

const Int = (n) => {
	if (n < 1) {
		throw new Error(`Int: n must be larger than 0, but got ${n}`);
	}

	if (n > 32) {
		throw new Error(`Int: n must be less than 32, but got ${n}`);
	}

	return sequenceOf(Array.from({ length: n }, () => Bit)).map((bits) => {
		if (bits[0] === 0) {
			return bits.reduce((acc, bit, i) => {
				return acc + Number(BigInt(bit) << BigInt(n - 1 - i));
			}, 0);
		} else {
			return -(
				1 +
				bits.reduce((acc, bit, i) => {
					return acc + Number(BigInt(bit === 0 ? 1 : 0) << BigInt(n - 1 - i));
				}, 0)
			);
		}
	});
};
const RawString = (s) => {
	if (s.length < 1) {
		throw new Error(`RawString: s must be at least 1 character`);
	}

	const byteParesers = s
		.split('')
		.map((c) => c.charCodeAt(0))
		.map((n) => {
			return Uint(8).chain((res) => {
				if (res === n) {
					return succeed(n);
				} else {
					return fail(
						`RawString: Expected character ${String.fromCharCode(n)}, but got ${String.fromCharCode(
							res,
						)}`,
					);
				}
			});
		});

	return sequenceOf(byteParesers);
};

const tag = (type) => (value) => ({ type, value });
const parser = sequenceOf([
	Uint(4).map(tag('Version')),
	Uint(4).map(tag('IHL')),
	Uint(6).map(tag('DSCP')),
	Uint(2).map(tag('ECN')),
	Uint(16).map(tag('Total Length')),
	Uint(16).map(tag('Identification')),
	Uint(3).map(tag('Flags')),
	Uint(13).map(tag('Fragment Offset')),
	Uint(8).map(tag('Time To Live')),
	Uint(8).map(tag('Protocol')),
	Uint(16).map(tag('Header Checksum')),
	Uint(32).map(tag('Source Address')),
	Uint(32).map(tag('Destintaion IP Adress')),
]).chain((res) => {
	if (res[1].value > 5) {
		const remainingBytes = Array.from({ length: res[1].value - 20 }, () => Uint(8));
		return sequenceOf(remainingBytes).map((remaining) => [...res, tag('Options')(remaining)]);
	}
	return succeed(res);
});

const file = fs.readFileSync(path.join(__dirname, './packet.bin'));
const dataView = new DataView(file.buffer, file.byteOffset, file.byteLength);
const res = parser.run(dataView);

const decodeIp = (number) => {
	return number
		.toString(16)
		.match(/.{1,2}/g)
		.map((h) => '0x' + h)
		.map((h) => parseInt(h));
};

const result = res.result;
const source = result[result.length - 2].value;

console.log(decodeIp(source));
