'use strict';

const assert = require('assert');

const { ApiSchemaBuilder, ApiSchemaBuilderError } = require('./../lib');

describe('ApiSchemaBuilder', () => {

	context('when nothing happens', () => {
		it('should do nothing', () => {
			assert(ApiSchemaBuilder);
			assert(ApiSchemaBuilderError);
		})
	});

});

describe('index', () => {

	before(() => {
		sandbox.stub(ApiSchemaBuilder.prototype, 'execute');
	});

	after(() => {
		sandbox.restore();
	});

	it('should run the index script without problems', () => {
		const index = require('./../index'); // eslint-disable-line
	});

});
