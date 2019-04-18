import { parse } from '@babel/babylon'
import generate from '@babel/generator'
import traverse, { Node, Visitor } from '@babel/traverse'
import { File } from '@babel/types'
import { pullAt } from 'lodash'

type Warning = [string, string, number, number]
type Rule = (warnings: Warning[]) => Visitor<Node>

let rules = new Map<string, Rule>()

export function addRule(ruleName: string, rule: Rule, overwrite?: boolean) {
  if (rules.has(ruleName) && !overwrite) {
    throw `A rule with the name "${ruleName}" is already defined`
  }
  rules.set(ruleName, rule)
}

export async function compile(code: string, filename: string) {
  let [warnings, ast] = await convert(
    parse(code, {
      plugins: ['classProperties', 'flow', 'objectRestSpread'],
      sourceType: 'module'
    })
  )

  warnings.forEach(([message, issueURL, line, column]) => {
    console.log(
      `Warning: ${message} (at ${filename}: line ${line}, column ${column}). See ${issueURL}`
    )
  })

  return generate(stripAtFlowAnnotation(ast)).code;
}

/**
 * @internal
 */
export async function convert<T extends Node>(ast: T): Promise<[Warning[], T]> {
  // load rules directory
  await import('./rules/index')

  let warnings: Warning[] = []
  rules.forEach(visitor => traverse(ast, visitor(warnings)))

  return [warnings, ast]
}

function stripAtFlowAnnotation(ast: File): File {
  let { leadingComments } = ast.program.body[0]
  if (leadingComments) {
    let index = leadingComments.findIndex(_ => _.value.trim() === '@flow')
    if (index > -1) {
      pullAt(leadingComments, index)
    }
  }
  return ast
}

// function addTrailingSpace(file: string): string {
//   if (file.endsWith(EOL)) {
//     return file
//   }
//   return file + EOL
// }

// function trimLeadingNewlines(file: string): string {
//   return dropWhile(file.split(EOL), _ => !_).join(EOL)
// }
