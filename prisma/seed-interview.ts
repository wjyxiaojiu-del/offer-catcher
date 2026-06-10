/**
 * 面霸题库种子数据脚本
 * 将 mianba 的内置题库 JSON 文件导入到 Prisma 数据库
 *
 * 使用方式：
 *   npx tsx prisma/seed-interview.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface QuestionJSON {
  id: string
  module: string
  difficulty: number
  question: string
  answer: string
  tags: string[]
  source?: string
}

// 题库目录结构
const QUESTION_DIRS = [
  { category: 'frontend', path: 'frontend' },
  { category: 'golang', path: 'golang' },
  { category: 'ai-agent', path: 'ai-agent' },
]

async function main() {
  console.log('🌱 开始导入面试题库...\n')

  // 内置题库目录（相对于 prisma/ 目录）
  const questionsRoot = join(__dirname, 'interview-questions')

  let totalImported = 0
  let totalSkipped = 0

  for (const dir of QUESTION_DIRS) {
    const dirPath = join(questionsRoot, dir.path)

    try {
      const files = readdirSync(dirPath).filter((f) => f.endsWith('.json'))
      console.log(`📁 ${dir.category}: ${files.length} 个文件`)

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
            console.warn(`  ⚠️ 跳过 ${q.id}: ${(e as Error).message}`)
            skipped++
          }
        }

        console.log(`  ✅ ${file}: ${imported} 导入, ${skipped} 跳过`)
        totalImported += imported
        totalSkipped += skipped
      }
    } catch (e) {
      console.error(`❌ 读取 ${dir.category} 失败: ${(e as Error).message}`)
    }
  }

  console.log(`\n✨ 完成！共导入 ${totalImported} 题，跳过 ${totalSkipped} 题`)

  // 统计
  const stats = await prisma.interviewQuestion.groupBy({
    by: ['module'],
    _count: { id: true },
  })

  console.log('\n📊 按模块统计：')
  for (const stat of stats) {
    console.log(`  ${stat.module}: ${stat._count.id} 题`)
  }
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
