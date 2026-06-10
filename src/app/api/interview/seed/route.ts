import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

interface QuestionJSON {
  id: string
  module: string
  difficulty: number
  question: string
  answer: string
  tags: string[]
  source?: string
}

const QUESTION_DIRS = [
  { category: 'frontend', path: 'frontend' },
  { category: 'golang', path: 'golang' },
  { category: 'ai-agent', path: 'ai-agent' },
]

export async function POST() {
  try {
    const questionsRoot = join(process.cwd(), 'prisma', 'interview-questions')
    let totalImported = 0
    let totalSkipped = 0
    const details: string[] = []

    for (const dir of QUESTION_DIRS) {
      const dirPath = join(questionsRoot, dir.path)
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith('.json'))
        for (const file of files) {
          const filePath = join(dirPath, file)
          const content = readFileSync(filePath, 'utf-8')
          const questions: QuestionJSON[] = JSON.parse(content)
          let imported = 0
          let skipped = 0

          for (const q of questions) {
            try {
              await prisma.interviewQuestion.upsert({
                where: { id: q.id },
                update: {
                  module: q.module,
                  difficulty: q.difficulty,
                  question: q.question,
                  answer: q.answer,
                  tags: JSON.stringify(q.tags || []),
                  source: q.source || 'builtin',
                },
                create: {
                  id: q.id,
                  module: q.module,
                  difficulty: q.difficulty,
                  question: q.question,
                  answer: q.answer,
                  tags: JSON.stringify(q.tags || []),
                  source: q.source || 'builtin',
                },
              })
              imported++
            } catch (e) {
              skipped++
            }
          }

          totalImported += imported
          totalSkipped += skipped
          details.push(`${dir.category}/${file}: ${imported} 导入, ${skipped} 跳过`)
        }
      } catch (e) {
        details.push(`❌ 读取 ${dir.category} 失败: ${(e as Error).message}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported: totalImported,
      skipped: totalSkipped,
      details,
    })
  } catch (error) {
    console.error('Seed interview error:', error)
    return NextResponse.json(
      { success: false, error: '导入失败，请检查服务器日志' },
      { status: 500 }
    )
  }
}
