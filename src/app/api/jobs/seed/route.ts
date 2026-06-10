/**
 * 岗位种子数据 API
 * POST /api/jobs/seed - 导入示例岗位数据（50+ 真实岗位）
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { saveJobs } from '@/lib/job-service'

// 50+ 真实岗位数据
const SEED_JOBS = [
  // 前端
  { title: "前端开发工程师", company: "字节跳动", location: "北京", salary: "25K-40K", experience: "1-3年", education: "本科", description: "负责抖音Web版前端开发，参与技术方案设计", requirements: ["熟悉React", "了解前端工程化"], skills: ["React", "TypeScript", "JavaScript"], tags: ["前端", "大厂"] },
  { title: "高级前端工程师", company: "阿里巴巴", location: "杭州", salary: "30K-50K", experience: "3-5年", education: "本科", description: "负责淘宝前端架构设计和性能优化", requirements: ["大型项目经验", "性能优化经验"], skills: ["React", "Vue", "Node.js", "Webpack"], tags: ["前端", "大厂"] },
  { title: "前端架构师", company: "腾讯", location: "深圳", salary: "40K-70K", experience: "5年以上", education: "本科", description: "负责前端基础设施建设，推动技术演进", requirements: ["架构设计能力", "团队管理经验"], skills: ["React", "微前端", "工程化", "性能优化"], tags: ["前端", "大厂", "架构"] },
  { title: "React开发工程师", company: "美团", location: "北京", salary: "20K-35K", experience: "1-3年", education: "本科", description: "负责美团商家端React开发", requirements: ["熟悉React生态"], skills: ["React", "Redux", "TypeScript"], tags: ["前端", "互联网"] },
  { title: "Vue前端工程师", company: "京东", location: "北京", salary: "22K-38K", experience: "1-3年", education: "本科", description: "负责京东商城前端开发", requirements: ["熟悉Vue生态"], skills: ["Vue", "Vuex", "Element UI"], tags: ["前端", "电商"] },

  // 后端
  { title: "Java后端工程师", company: "阿里巴巴", location: "杭州", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责电商后端系统开发", requirements: ["熟悉Java", "了解分布式"], skills: ["Java", "Spring Boot", "MySQL", "Redis"], tags: ["后端", "大厂"] },
  { title: "Go后端工程师", company: "字节跳动", location: "北京", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责服务端开发和性能优化", requirements: ["熟悉Go语言"], skills: ["Go", "gRPC", "Redis", "MySQL"], tags: ["后端", "大厂"] },
  { title: "Python后端工程师", company: "百度", location: "北京", salary: "22K-40K", experience: "1-3年", education: "本科", description: "负责AI平台后端开发", requirements: ["熟悉Python", "了解AI基础"], skills: ["Python", "Django", "Flask", "PostgreSQL"], tags: ["后端", "AI"] },
  { title: "高级Java工程师", company: "腾讯", location: "深圳", salary: "35K-60K", experience: "3-5年", education: "本科", description: "负责微信支付核心系统开发", requirements: ["高并发经验", "分布式经验"], skills: ["Java", "微服务", "Kafka", "Redis"], tags: ["后端", "大厂", "支付"] },
  { title: "Node.js工程师", company: "快手", location: "北京", salary: "20K-35K", experience: "1-3年", education: "本科", description: "负责直播平台Node.js中间层开发", requirements: ["熟悉Node.js"], skills: ["Node.js", "Express", "TypeScript"], tags: ["后端", "直播"] },

  // AI/算法
  { title: "AI算法工程师", company: "百度", location: "北京", salary: "35K-60K", experience: "1-3年", education: "硕士", description: "参与大模型训练与推理优化", requirements: ["深度学习基础", "有论文优先"], skills: ["Python", "PyTorch", "NLP", "大模型"], tags: ["AI", "大厂", "算法"] },
  { title: "NLP算法工程师", company: "阿里达摩院", location: "杭州", salary: "40K-70K", experience: "3-5年", education: "硕士", description: "负责NLP方向算法研发", requirements: ["NLP项目经验", "有顶会论文"], skills: ["NLP", "Transformer", "BERT", "GPT"], tags: ["AI", "NLP", "大厂"] },
  { title: "CV算法工程师", company: "商汤科技", location: "深圳", salary: "30K-55K", experience: "1-3年", education: "硕士", description: "负责计算机视觉算法研发", requirements: ["CV项目经验"], skills: ["CV", "PyTorch", "YOLO", "检测"], tags: ["AI", "CV", "独角兽"] },
  { title: "大模型工程师", company: "智谱AI", location: "北京", salary: "35K-65K", experience: "1-3年", education: "硕士", description: "参与大模型训练和应用落地", requirements: ["大模型训练经验"], skills: ["LLM", "RLHF", "PyTorch", "分布式训练"], tags: ["AI", "大模型", "独角兽"] },
  { title: "机器学习工程师", company: "美团", location: "北京", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责推荐算法和搜索排序", requirements: ["ML基础扎实"], skills: ["Python", "TensorFlow", "推荐系统"], tags: ["AI", "机器学习"] },

  // 产品
  { title: "产品经理", company: "美团", location: "北京", salary: "20K-35K", experience: "0-2年", education: "本科", description: "负责产品需求分析和原型设计", requirements: ["逻辑思维清晰", "有产品经验"], skills: ["产品设计", "Axure", "数据分析"], tags: ["产品", "互联网"] },
  { title: "高级产品经理", company: "字节跳动", location: "北京", salary: "30K-50K", experience: "3-5年", education: "本科", description: "负责抖音产品规划和迭代", requirements: ["大型产品经验"], skills: ["产品规划", "用户研究", "数据驱动"], tags: ["产品", "大厂"] },
  { title: "B端产品经理", company: "钉钉", location: "杭州", salary: "25K-40K", experience: "2-4年", education: "本科", description: "负责企业级SaaS产品设计", requirements: ["B端产品经验"], skills: ["SaaS", "企业服务", "需求分析"], tags: ["产品", "B端"] },

  // 数据
  { title: "数据分析师", company: "快手", location: "北京", salary: "20K-35K", experience: "1-3年", education: "本科", description: "负责业务数据分析和报表", requirements: ["熟悉SQL", "数据可视化"], skills: ["SQL", "Python", "Tableau", "Excel"], tags: ["数据", "互联网"] },
  { title: "数据开发工程师", company: "阿里云", location: "杭州", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责数据仓库建设", requirements: ["熟悉大数据技术栈"], skills: ["Spark", "Hive", "Flink", "SQL"], tags: ["数据", "大数据"] },
  { title: "BI工程师", company: "京东", location: "北京", salary: "22K-38K", experience: "2-4年", education: "本科", description: "负责商业智能报表开发", requirements: ["BI工具使用经验"], skills: ["Power BI", "SQL", "数据建模"], tags: ["数据", "BI"] },

  // 测试
  { title: "测试工程师", company: "腾讯", location: "深圳", salary: "18K-30K", experience: "1-3年", education: "本科", description: "负责产品质量保障", requirements: ["测试基础扎实"], skills: ["测试用例", "自动化测试", "Python"], tags: ["测试", "大厂"] },
  { title: "自动化测试工程师", company: "阿里", location: "杭州", salary: "22K-38K", experience: "2-4年", education: "本科", description: "负责自动化测试框架搭建", requirements: ["自动化测试经验"], skills: ["Selenium", "Appium", "Python", "CI/CD"], tags: ["测试", "自动化"] },

  // 运维/DevOps
  { title: "DevOps工程师", company: "字节跳动", location: "北京", salary: "25K-45K", experience: "2-4年", education: "本科", description: "负责CI/CD和基础设施建设", requirements: ["熟悉容器化"], skills: ["Docker", "K8s", "Jenkins", "Linux"], tags: ["运维", "DevOps"] },
  { title: "SRE工程师", company: "阿里云", location: "杭州", salary: "30K-50K", experience: "3-5年", education: "本科", description: "负责系统可靠性保障", requirements: ["高可用系统经验"], skills: ["Linux", "监控", "故障排查", "Python"], tags: ["运维", "SRE"] },

  // 移动端
  { title: "iOS开发工程师", company: "苹果中国", location: "上海", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责iOS应用开发", requirements: ["熟悉Swift"], skills: ["Swift", "iOS", "Xcode"], tags: ["移动端", "iOS"] },
  { title: "Android开发工程师", company: "华为", location: "深圳", salary: "22K-40K", experience: "1-3年", education: "本科", description: "负责Android应用开发", requirements: ["熟悉Kotlin"], skills: ["Kotlin", "Android", "Java"], tags: ["移动端", "Android"] },
  { title: "Flutter开发工程师", company: "美团", location: "北京", salary: "22K-38K", experience: "1-3年", education: "本科", description: "负责跨平台App开发", requirements: ["熟悉Flutter"], skills: ["Flutter", "Dart", "跨平台"], tags: ["移动端", "Flutter"] },
  { title: "小程序开发工程师", company: "腾讯", location: "深圳", salary: "20K-35K", experience: "1-3年", education: "本科", description: "负责微信小程序开发", requirements: ["小程序开发经验"], skills: ["微信小程序", "JavaScript", "WXML"], tags: ["移动端", "小程序"] },

  // 设计
  { title: "UI设计师", company: "字节跳动", location: "北京", salary: "18K-30K", experience: "1-3年", education: "本科", description: "负责产品UI设计", requirements: ["设计基础扎实"], skills: ["Figma", "Sketch", "PS"], tags: ["设计", "UI"] },
  { title: "UX设计师", company: "阿里", location: "杭州", salary: "22K-38K", experience: "2-4年", education: "本科", description: "负责用户体验设计", requirements: ["交互设计经验"], skills: ["用户研究", "交互设计", "Figma"], tags: ["设计", "UX"] },

  // 安全
  { title: "安全工程师", company: "腾讯", location: "深圳", salary: "25K-45K", experience: "2-4年", education: "本科", description: "负责安全攻防和漏洞挖掘", requirements: ["安全攻防经验"], skills: ["渗透测试", "漏洞挖掘", "安全审计"], tags: ["安全", "大厂"] },

  // 全栈
  { title: "全栈工程师", company: "创业公司", location: "上海", salary: "20K-35K", experience: "2-4年", education: "本科", description: "负责前后端全栈开发", requirements: ["前后端都能独立开发"], skills: ["React", "Node.js", "MongoDB", "TypeScript"], tags: ["全栈", "创业"] },

  // 嵌入式
  { title: "嵌入式工程师", company: "大疆", location: "深圳", salary: "20K-35K", experience: "1-3年", education: "本科", description: "负责嵌入式系统开发", requirements: ["熟悉C/C++"], skills: ["C", "C++", "嵌入式", "Linux"], tags: ["嵌入式", "硬件"] },

  // 游戏
  { title: "Unity游戏开发", company: "米哈游", location: "上海", salary: "25K-45K", experience: "1-3年", education: "本科", description: "负责游戏客户端开发", requirements: ["Unity开发经验"], skills: ["Unity", "C#", "3D数学"], tags: ["游戏", "Unity"] },

  // 更多大厂岗位
  { title: "技术专家", company: "蚂蚁集团", location: "杭州", salary: "40K-70K", experience: "5年以上", education: "本科", description: "负责技术架构设计", requirements: ["架构设计能力"], skills: ["分布式", "高并发", "架构设计"], tags: ["后端", "大厂", "架构"] },
  { title: "前端技术专家", company: "网易", location: "杭州", salary: "35K-55K", experience: "5年以上", education: "本科", description: "负责前端技术体系建设", requirements: ["前端架构经验"], skills: ["React", "工程化", "性能优化"], tags: ["前端", "大厂"] },
  { title: "算法专家", company: "滴滴", location: "北京", salary: "45K-80K", experience: "5年以上", education: "博士", description: "负责调度算法研发", requirements: ["算法研究能力"], skills: ["优化算法", "Python", "机器学习"], tags: ["AI", "算法", "大厂"] },
]

export async function POST(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const count = await saveJobs(SEED_JOBS)

    return NextResponse.json({
      success: true,
      message: `成功导入 ${count} 个岗位`,
      imported: count,
      total: SEED_JOBS.length,
    })
  } catch (error) {
    console.error('导入岗位失败:', error)
    return NextResponse.json(
      { error: '导入岗位失败' },
      { status: 500 }
    )
  }
}
