# api-schema-builder
![Build Status](https://github.com/janis-commerce/api-schema-builder/workflows/Build%20Status/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/api-schema-builder/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/api-schema-builder?branch=master)

Build the Api Schemas.

## Usage

In the console

```sh
npx @janiscommerce/api-schema-builder
```

* It will build `/root/schemas/public.json` with the Api schema.
* If the file exist it will be override.

## Configuration

The Api Schemas must be in *Yaml* files in `/root/schemas/src/`, according to [OpenAPI 3.0.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md) specification.
