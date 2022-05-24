'use strict'

const test = require('tap').test
const build = require('..')

test('deep union type', (t) => {
  const stringify = build({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          {
            $ref: 'components#/schemas/IDirectory'
          },
          {
            $ref: 'components#/schemas/IImageFile'
          },
          {
            $ref: 'components#/schemas/ITextFile'
          },
          {
            $ref: 'components#/schemas/IZipFile'
          }
        ]
      },
      nullable: false
    },
    components: {
      schemas: {
        IDirectory: {
          $id: 'IDirectory',
          $recursiveAnchor: true,
          type: 'object',
          properties: {
            children: {
              type: 'array',
              items: {
                oneOf: [
                  {
                    $recursiveRef: '#'
                  },
                  {
                    $ref: 'components#/schemas/IImageFile'
                  },
                  {
                    $ref: 'components#/schemas/ITextFile'
                  },
                  {
                    $ref: 'components#/schemas/IZipFile'
                  }
                ]
              },
              nullable: false
            },
            type: {
              type: 'string',
              nullable: false
            },
            id: {
              type: 'string',
              nullable: false
            },
            name: {
              type: 'string',
              nullable: false
            }
          },
          nullable: false,
          required: [
            'children',
            'type',
            'id',
            'name'
          ]
        },
        IImageFile: {
          $id: 'IImageFile',
          type: 'object',
          properties: {
            width: {
              type: 'number',
              nullable: false
            },
            height: {
              type: 'number',
              nullable: false
            },
            url: {
              type: 'string',
              nullable: false
            },
            extension: {
              type: 'string',
              nullable: false
            },
            size: {
              type: 'number',
              nullable: false
            },
            type: {
              type: 'string',
              nullable: false
            },
            id: {
              type: 'string',
              nullable: false
            },
            name: {
              type: 'string',
              nullable: false
            }
          },
          nullable: false,
          required: [
            'width',
            'height',
            'url',
            'extension',
            'size',
            'type',
            'id',
            'name'
          ]
        },
        ITextFile: {
          $id: 'ITextFile',
          type: 'object',
          properties: {
            content: {
              type: 'string',
              nullable: false
            },
            extension: {
              type: 'string',
              nullable: false
            },
            size: {
              type: 'number',
              nullable: false
            },
            type: {
              type: 'string',
              nullable: false
            },
            id: {
              type: 'string',
              nullable: false
            },
            name: {
              type: 'string',
              nullable: false
            }
          },
          nullable: false,
          required: [
            'content',
            'extension',
            'size',
            'type',
            'id',
            'name'
          ]
        },
        IZipFile: {
          $id: 'IZipFile',
          type: 'object',
          properties: {
            files: {
              type: 'number',
              nullable: false
            },
            extension: {
              type: 'string',
              nullable: false
            },
            size: {
              type: 'number',
              nullable: false
            },
            type: {
              type: 'string',
              nullable: false
            },
            id: {
              type: 'string',
              nullable: false
            },
            name: {
              type: 'string',
              nullable: false
            }
          },
          nullable: false,
          required: [
            'files',
            'extension',
            'size',
            'type',
            'id',
            'name'
          ]
        }
      }
    }
  })

  const obj = [
    {
      type: 'directory',
      id: '7b1068a4-dd6e-474a-8d85-09a2d77639cb',
      name: 'ixcWGOKI',
      children: [
        {
          type: 'directory',
          id: '5883e17c-b207-46d4-ad2d-be72249711ce',
          name: 'vecQwFGS',
          children: []
        },
        {
          type: 'file',
          id: '670b6556-a610-4a48-8a16-9c2da97a0d18',
          name: 'eStFddzX',
          extension: 'jpg',
          size: 7,
          width: 300,
          height: 1200,
          url: 'https://github.com/samchon/typescript-json'
        },
        {
          type: 'file',
          id: '85dc796d-9593-4833-b1a1-addc8ebf74ea',
          name: 'kTdUfwRJ',
          extension: 'ts',
          size: 86,
          content: 'console.log("Hello world");'
        },
        {
          type: 'file',
          id: '8933c86a-7a1e-4d4a-b0a6-17d6896fdf89',
          name: 'NBPkefUG',
          extension: 'zip',
          size: 22,
          files: 20
        }
      ]
    }
  ]
  t.equal(JSON.stringify(obj), stringify(obj))
  t.autoend()
})
