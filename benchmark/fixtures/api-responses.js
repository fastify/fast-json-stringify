'use strict'

const addressSchema = {
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    apartment: { type: ['string', 'null'] }
  }
}

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sku: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    price: {
      type: 'object',
      properties: {
        amount: { type: 'integer' },
        currency: { type: 'string' },
        discount: { type: ['number', 'null'] }
      }
    },
    inventory: {
      type: 'object',
      properties: {
        available: { type: 'boolean' },
        quantity: { type: 'integer' },
        warehouse: { type: 'string' }
      }
    },
    tags: { type: 'array', items: { type: 'string' } },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          alt: { type: 'string' },
          primary: { type: 'boolean' }
        }
      }
    },
    rating: {
      type: 'object',
      properties: {
        average: { type: 'number' },
        count: { type: 'integer' }
      }
    },
    updatedAt: { type: 'string' }
  }
}

// Deterministic synthetic responses include Unicode and escaping, as API payloads do.
const address = {
  street: '12 Example Street',
  city: 'Łódź',
  postalCode: '90-001',
  country: 'PL',
  apartment: null
}

const products = Array.from({ length: 50 }, (_, i) => ({
  id: `product_${i + 1}`,
  sku: `MUG-${1000 + i}`,
  name: `Café mug "Everyday" — ${i + 1}`,
  description: 'Handmade ceramic mug ☕\nDishwasher safe. Available in blue, green, and cream.',
  price: {
    amount: 1800 + i * 100,
    currency: 'EUR',
    discount: i % 2 === 0 ? null : 0.1
  },
  inventory: { available: i % 7 !== 0, quantity: i * 3, warehouse: 'eu-central' },
  tags: ['home', 'kitchen', i % 2 === 0 ? 'ceramic' : 'stoneware'],
  images: [
    { url: `https://example.com/products/${i + 1}/front.jpg`, alt: 'Front view', primary: true },
    { url: `https://example.com/products/${i + 1}/side.jpg`, alt: 'Side view', primary: false }
  ],
  rating: { average: 4.2 + (i % 5) / 10, count: 10 + i * 7 },
  updatedAt: '2026-01-15T10:30:00.000Z'
}))

const orderItems = products.slice(0, 5).map((product, i) => ({
  product,
  quantity: i + 1,
  unitPrice: product.price.amount,
  total: product.price.amount * (i + 1)
}))
const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)

module.exports = [
  {
    name: 'user profile response',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            displayName: { type: 'string' },
            bio: { type: 'string' },
            avatarUrl: { type: ['string', 'null'] },
            active: { type: 'boolean' },
            roles: { type: 'array', items: { type: 'string' } },
            address: addressSchema,
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                plan: { type: 'string' }
              }
            },
            preferences: {
              type: 'object',
              properties: {
                locale: { type: 'string' },
                timezone: { type: 'string' },
                notifications: {
                  type: 'object',
                  properties: {
                    email: { type: 'boolean' },
                    push: { type: 'boolean' },
                    digest: { type: 'string' }
                  }
                }
              }
            },
            createdAt: { type: 'string' },
            lastLoginAt: { type: ['string', 'null'] }
          }
        },
        meta: {
          type: 'object',
          properties: { requestId: { type: 'string' }, version: { type: 'integer' } }
        }
      }
    },
    input: {
      data: {
        id: 'user_123',
        email: 'alex@example.com',
        displayName: 'Alex Żółć',
        bio: 'Engineer & coffee enthusiast ☕\nWorking on "Project Atlas".',
        avatarUrl: null,
        active: true,
        roles: ['member', 'billing-admin'],
        address,
        organization: { id: 'org_456', name: 'Example & Co.', plan: 'business' },
        preferences: {
          locale: 'pl-PL',
          timezone: 'Europe/Warsaw',
          notifications: { email: true, push: false, digest: 'weekly' }
        },
        createdAt: '2025-06-01T08:00:00.000Z',
        lastLoginAt: '2026-01-15T10:30:00.000Z'
      },
      meta: { requestId: 'req_profile_123', version: 1 }
    }
  },
  {
    name: 'order response',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        },
        shippingAddress: addressSchema,
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: productSchema,
              quantity: { type: 'integer' },
              unitPrice: { type: 'integer' },
              total: { type: 'integer' }
            }
          }
        },
        totals: {
          type: 'object',
          properties: {
            subtotal: { type: 'integer' },
            shipping: { type: 'integer' },
            tax: { type: 'integer' },
            total: { type: 'integer' },
            currency: { type: 'string' }
          }
        },
        payment: {
          type: 'object',
          properties: {
            method: { type: 'string' },
            paid: { type: 'boolean' },
            transactionId: { type: ['string', 'null'] }
          }
        },
        notes: { type: ['string', 'null'] },
        createdAt: { type: 'string' }
      }
    },
    input: {
      id: 'order_789',
      status: 'processing',
      customer: { id: 'user_123', name: 'Alex Żółć', email: 'alex@example.com' },
      shippingAddress: address,
      items: orderItems,
      totals: { subtotal, shipping: 500, tax: 4200, total: subtotal + 4700, currency: 'EUR' },
      payment: { method: 'card', paid: true, transactionId: 'txn_987' },
      notes: 'Please ring the bell marked "Office".\nLeave with reception if unavailable.',
      createdAt: '2026-01-15T10:30:00.000Z'
    }
  },
  {
    name: 'paginated products response',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: productSchema },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
            hasNextPage: { type: 'boolean' }
          }
        },
        links: {
          type: 'object',
          properties: {
            self: { type: 'string' },
            next: { type: 'string' },
            previous: { type: ['string', 'null'] }
          }
        }
      }
    },
    input: {
      data: products,
      pagination: { page: 1, pageSize: 50, total: 1248, hasNextPage: true },
      links: {
        self: '/products?page=1&pageSize=50',
        next: '/products?page=2&pageSize=50',
        previous: null
      }
    }
  }
]
