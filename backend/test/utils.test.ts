import { describe, test, expect, it } from 'vitest'
import { myCustomAdd, fabonacci } from '../src/utils/math'

describe('math utils testing', () => {
  describe('myCustomAdd testing', () => {
    it('should return 3 when add 1 and 2', () => {
      // arrange
      const a = 1
      const b = 2

      // act
      const actual = myCustomAdd(a, b)

      // assert
      expect(actual).toBe(3)
    })
    it('should return 5 when add 2 and 3', () => {
      expect(myCustomAdd(2, 3)).toBe(5)
    })
  })

  describe('fabonacci testing', () => {
    it('should return 1 when n is 1', () => {
      expect(fabonacci(1)).toBe(1)
    })
    it('should return 1 when n is 2', () => {
      // arrange
      const n = 2

      // act
      const actual = fabonacci(n)

      // assert
      expect(actual).toBe(1)
    })
    it('should return 2 when n is 3', () => {
      // arrange
      const n = 3

      // act
      const actual = fabonacci(n)

      // assert
      expect(actual).toBe(2)
    })
  })
})
