import { describe, it, expect } from 'vitest'
import { parseJavaClasses, generateClassDiagramSvg } from './staticClassDiagram.js'

describe('staticClassDiagram', () => {
  const sample = `
public class Main {
  private Student student;
  public static void main(String[] args) {
    System.out.println("hi");
  }
}
class Student {
  private int id;
  private String name;
  public String getName() { return name; }
}
`

  it('parses class and interface names from Java source', () => {
    const classes = parseJavaClasses(sample, 'Main.java')
    const names = classes.map(c => c.name)
    expect(names).toContain('Main')
    expect(names).toContain('Student')
  })

  it('extracts at least one field and one method', () => {
    const classes = parseJavaClasses(sample, 'Main.java')
    const student = classes.find(c => c.name === 'Student')
    expect(student).toBeDefined()
    expect(student.fields.some(f => f.includes('name'))).toBe(true)
    expect(student.methods.some(m => m.includes('getName'))).toBe(true)
  })

  it('generates valid SVG containing class names', () => {
    const svg = generateClassDiagramSvg([{ name: 'Main.java', code: sample }])
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain('Main')
    expect(svg).toContain('Student')
    expect(svg).not.toMatch(/<script/i)
  })

  it('returns empty-state SVG when no types found', () => {
    const svg = generateClassDiagramSvg([{ name: 'Empty.java', code: '// no types' }])
    expect(svg).toContain('未识别到类')
  })
})
