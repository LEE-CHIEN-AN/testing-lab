import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { serverOf } from '../src/server'
import * as TodoRepo from '../src/repo/todo'
import { FastifyInstance } from 'fastify'
import { Todo } from '../src/types/todo'

describe('Todo POST API Testing', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = serverOf()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('Given valid name and description, When receive a POST /api/v1/todos request, Then it should response with status code 201 and the created todo', async () => {
    // arrange: mock the repo function to return the created todo
    const createdTodo: Todo = {
      id: 'mock-id-1',
      name: 'Buy groceries',
      description: 'Go to the supermarket',
      status: false
    }
    const createSpy = vi.spyOn(TodoRepo, 'createTodo').mockResolvedValue(createdTodo)

    // act: send POST /api/v1/todos with valid body
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/todos',
      payload: JSON.stringify({ name: 'Buy groceries', description: 'Go to the supermarket' }),
      headers: { 'Content-Type': 'application/json' }
    })

    // assert: status 201 and body contains the created todo
    expect(response.statusCode).toBe(201)
    const result = JSON.parse(response.body)['todo']
    expect(result).toStrictEqual(createdTodo)

    // assert: repo was called exactly once with the correct payload
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Buy groceries', description: 'Go to the supermarket' })
    )
  })

  test('Given the repo throws an error, When receive a POST /api/v1/todos request, Then it should response with status code 500', async () => {
    // arrange: mock the repo to throw
    vi.spyOn(TodoRepo, 'createTodo').mockRejectedValue(new Error('DB connection failed'))

    // act
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/todos',
      payload: JSON.stringify({ name: 'Buy groceries', description: 'Go to the supermarket' }),
      headers: { 'Content-Type': 'application/json' }
    })

    // assert: server should swallow the error and return 500
    expect(response.statusCode).toBe(500)
  })
})
