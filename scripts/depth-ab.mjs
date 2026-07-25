import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const execution = spawnSync(process.execPath, ['scripts/playability-sim.mjs', '500'], {
    cwd: root,
    encoding: 'utf8',
})
if (execution.status !== 0) {
    process.stderr.write(execution.stdout)
    process.stderr.write(execution.stderr)
    process.exit(execution.status ?? 1)
}
const result = JSON.parse(readFileSync(join(root, 'verification/playability-result.json'), 'utf8'))
const report = {
    pass: result.pass && result.depthAB.completionAdvantagePercentagePoints >= 25,
    sourceHash: result.sourceHash,
    tickSeconds: result.tickSeconds,
    actionIntervalSeconds: result.actionIntervalSeconds,
    sameSeeds: result.depthAB.sameSeeds,
    axis: result.depthAB.axis,
    guided: result.guided,
    ignoringCrease: result.ignoringCrease,
    completionAdvantagePercentagePoints: result.depthAB.completionAdvantagePercentagePoints,
    representative: result.representative,
}
mkdirSync(join(root, 'verification'), { recursive: true })
writeFileSync(join(root, 'verification/depth-ab.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
