import { createInterface } from 'node:readline'
import { createWriteStream } from 'node:fs'
import { spawn } from 'node:child_process'

import prompts from 'prompts'

const atUppyPackagePath = /^packages\/(@uppy\/[a-z0-9-]+)\//
async function inferPackageForCommit (sha, spawnOptions) {
  const cp = spawn('git', ['--no-pager', 'log', '-1', '--name-only', sha], spawnOptions)
  const candidates = {}
  for await (const path of createInterface({ input: cp.stdout })) {
    const match = atUppyPackagePath.exec(path)
    if (match != null) {
      candidates[match[1]] ??= 0
      candidates[match[1]]++
    }
  }
  const maxVal = Math.max(...Object.values(candidates))
  return {
    inferredPackage: Number.isFinite(maxVal)
      ? Object.entries(candidates).find(
        ([, nbOfFiles]) => nbOfFiles === maxVal
      )[0]
      : 'meta',
    candidates,
  }
}

export default async function formatChangeLog (
  spawnOptions,
  LAST_RELEASE_COMMIT,
  changeLogUrl
) {
  const changeLogCommits = createWriteStream(changeLogUrl)

  const gitLog = spawn('git', [
    '--no-pager',
    'log',
    '--format="%H::%s::%an"',
    `${LAST_RELEASE_COMMIT}..HEAD`,
  ], spawnOptions)
  const expectedFormat = /^"([a-f0-9]+)::(?:(@uppy\/[a-z0-9-]+|meta)+:\s?)?(.+?)(\s\(#\d+\))?::(.+)"$/
  for await (const log of createInterface({ input: gitLog.stdout })) {
    const [, sha, packageName, title, PR, authorName] = expectedFormat.exec(log)

    const formattedCommitTitle = {
      packageName,
      title,
      authorInfo: PR ? `${authorName} / #${PR.slice(3, -1)}` : authorName,
    }

    if (!packageName) {
      console.log(
        `No package info found in commit title: ${sha} (https://github.com/transloadit/uppy/commit/${sha})`
      )
      console.log(log)
      const { inferredPackage, candidates } = await inferPackageForCommit(sha, spawnOptions)
      const { useInferred } = await prompts({
        type: 'confirm',
        name: 'useInferred',
        message: `Use ${inferredPackage} (inferred from the files it touches)?`,
        initial: true,
      })

      if (useInferred) {
        formattedCommitTitle.packageName = inferredPackage
      } else {
        const response = await prompts({
          type: 'autocomplete',
          name: 'value',
          message: 'Which package does this commit belong to?',
          choices: [
            { title: 'Meta', value: 'meta' },
            ...Object.entries(candidates)
              .sort((a, b) => a[1] > b[1])
              .map(([value]) => ({ title: value, value })),
          ],
        })
        formattedCommitTitle.packageName = response.value
      }
    }

    changeLogCommits.write(
      `- ${formattedCommitTitle.packageName}: ${formattedCommitTitle.title} (${formattedCommitTitle.authorInfo})\n`
    )
  }

  changeLogCommits.close()
}
