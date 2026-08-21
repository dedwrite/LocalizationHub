import fs from 'node:fs'
import process from 'node:process'
import {
  parse,
} from 'lossless-json'

const [
  originalPath,
  exportedPath,
] =
  process.argv.slice(2)

if (
  !originalPath ||
  !exportedPath
) {
  console.error(
    `
Usage:

node scripts/compare-export.mjs "<original.json>" "<exported.json>"
`,
  )

  process.exit(1)
}

function readJson(
  filePath,
) {
  const text =
    fs.readFileSync(
      filePath,
      'utf8',
    )

  return parse(
    text,
  )
}

function isLosslessNumber(
  value,
) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.constructor?.name ===
      'LosslessNumber'
  )
}

function describeValue(
  value,
) {
  if (
    isLosslessNumber(
      value,
    )
  ) {
    return String(
      value.value,
    )
  }

  if (
    typeof value === 'string'
  ) {
    const shortened =
      value.length > 120
        ? `${value.slice(0, 117)}...`
        : value

    return JSON.stringify(
      shortened,
    )
  }

  if (
    value === null
  ) {
    return 'null'
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return `[Array(${value.length})]`
  }

  if (
    typeof value === 'object'
  ) {
    return '{Object}'
  }

  return String(
    value,
  )
}

function valuesEqual(
  left,
  right,
) {
  if (
    isLosslessNumber(left) ||
    isLosslessNumber(right)
  ) {
    return (
      isLosslessNumber(left) &&
      isLosslessNumber(right) &&
      String(left.value) ===
        String(right.value)
    )
  }

  return Object.is(
    left,
    right,
  )
}

function appendObjectPath(
  path,
  key,
) {
  if (
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
      key,
    )
  ) {
    return path
      ? `${path}.${key}`
      : key
  }

  return `${path}[${JSON.stringify(key)}]`
}

function appendArrayPath(
  path,
  index,
) {
  return `${path}[${index}]`
}

function compareJson(
  original,
  exported,
) {
  const differences =
    []

  const stats = {
    comparedValues:
      0,

    arrays:
      0,

    objects:
      0,

    losslessNumbers:
      0,
  }

  function addDifference(
    path,
    kind,
    before,
    after,
  ) {
    differences.push({
      path:
        path || '$',

      kind,

      before,

      after,
    })
  }

  function walk(
    left,
    right,
    path = '$',
  ) {
    stats.comparedValues +=
      1

    if (
      isLosslessNumber(left) ||
      isLosslessNumber(right)
    ) {
      stats.losslessNumbers +=
        1

      if (
        !valuesEqual(
          left,
          right,
        )
      ) {
        addDifference(
          path,
          'value-changed',
          left,
          right,
        )
      }

      return
    }

    const leftIsArray =
      Array.isArray(
        left,
      )

    const rightIsArray =
      Array.isArray(
        right,
      )

    if (
      leftIsArray ||
      rightIsArray
    ) {
      if (
        !leftIsArray ||
        !rightIsArray
      ) {
        addDifference(
          path,
          'type-changed',
          left,
          right,
        )

        return
      }

      stats.arrays +=
        1

      if (
        left.length !==
        right.length
      ) {
        addDifference(
          path,
          'array-length-changed',
          left.length,
          right.length,
        )
      }

      const maxLength =
        Math.max(
          left.length,
          right.length,
        )

      for (
        let index = 0;
        index < maxLength;
        index += 1
      ) {
        const itemPath =
          appendArrayPath(
            path,
            index,
          )

        if (
          index >=
          left.length
        ) {
          addDifference(
            itemPath,
            'added',
            undefined,
            right[index],
          )

          continue
        }

        if (
          index >=
          right.length
        ) {
          addDifference(
            itemPath,
            'removed',
            left[index],
            undefined,
          )

          continue
        }

        walk(
          left[index],
          right[index],
          itemPath,
        )
      }

      return
    }

    const leftIsObject =
      (
        left !== null &&
        typeof left ===
          'object'
      )

    const rightIsObject =
      (
        right !== null &&
        typeof right ===
          'object'
      )

    if (
      leftIsObject ||
      rightIsObject
    ) {
      if (
        !leftIsObject ||
        !rightIsObject
      ) {
        addDifference(
          path,
          'type-changed',
          left,
          right,
        )

        return
      }

      stats.objects +=
        1

      const leftKeys =
        Object.keys(
          left,
        )

      const rightKeys =
        Object.keys(
          right,
        )

      const allKeys =
        new Set([
          ...leftKeys,
          ...rightKeys,
        ])

      for (
        const key
        of allKeys
      ) {
        const childPath =
          appendObjectPath(
            path,
            key,
          )

        const leftHasKey =
          Object.prototype
            .hasOwnProperty
            .call(
              left,
              key,
            )

        const rightHasKey =
          Object.prototype
            .hasOwnProperty
            .call(
              right,
              key,
            )

        if (
          !leftHasKey
        ) {
          addDifference(
            childPath,
            'added',
            undefined,
            right[key],
          )

          continue
        }

        if (
          !rightHasKey
        ) {
          addDifference(
            childPath,
            'removed',
            left[key],
            undefined,
          )

          continue
        }

        walk(
          left[key],
          right[key],
          childPath,
        )
      }

      return
    }

    if (
      !valuesEqual(
        left,
        right,
      )
    ) {
      addDifference(
        path,
        'value-changed',
        left,
        right,
      )
    }
  }

  walk(
    original,
    exported,
  )

  return {
    differences,
    stats,
  }
}

try {
  console.log(
    '\nLocalizationHub Export Integrity Check\n',
  )

  console.log(
    `Original: ${originalPath}`,
  )

  console.log(
    `Export:   ${exportedPath}\n`,
  )

  const original =
    readJson(
      originalPath,
    )

  const exported =
    readJson(
      exportedPath,
    )

  const {
    differences,
    stats,
  } =
    compareJson(
      original,
      exported,
    )

  console.log(
    `Compared values: ${stats.comparedValues.toLocaleString()}`,
  )

  console.log(
    `Objects:         ${stats.objects.toLocaleString()}`,
  )

  console.log(
    `Arrays:          ${stats.arrays.toLocaleString()}`,
  )

  console.log(
    `Lossless nums:   ${stats.losslessNumbers.toLocaleString()}`,
  )

  console.log(
    `Differences:     ${differences.length.toLocaleString()}\n`,
  )

  if (
    differences.length ===
    0
  ) {
    console.log(
      '✅ Files are structurally identical.',
    )

    process.exit(0)
  }

  console.log(
    'Changed paths:\n',
  )

  const displayLimit =
    50

  for (
    const difference
    of differences.slice(
      0,
      displayLimit,
    )
  ) {
    console.log(
      `• ${difference.path}`,
    )

    console.log(
      `  Type:   ${difference.kind}`,
    )

    console.log(
      `  Before: ${describeValue(difference.before)}`,
    )

    console.log(
      `  After:  ${describeValue(difference.after)}`,
    )

    console.log()
  }

  if (
    differences.length >
    displayLimit
  ) {
    console.log(
      `... ${(
        differences.length -
        displayLimit
      ).toLocaleString()} more differences not shown.\n`,
    )
  }

  /*
   * الاختبار اللي سويناه:
   * غيرنا ترجمة واحدة فقط إلى
   * EXPORT_TEST_123
   */
  const exportTestDifferences =
    differences.filter(
      (difference) =>
        difference.kind ===
          'value-changed' &&
        difference.after ===
          'EXPORT_TEST_123',
    )

  if (
    differences.length === 1 &&
    exportTestDifferences.length ===
      1
  ) {
    console.log(
      '✅ PASS: Exactly one value changed.',
    )

    console.log(
      `✅ Changed path: ${exportTestDifferences[0].path}`,
    )

    console.log(
      '✅ New value is EXPORT_TEST_123.',
    )

    console.log(
      '✅ All other structure, metadata, array order, IDs, and numbers remained unchanged.',
    )

    process.exit(0)
  }

  console.log(
    '⚠️ CHECK REQUIRED: More than the expected single translation value changed.',
  )

  process.exit(2)
} catch (
  error
) {
  console.error(
    '\n❌ Integrity check failed:\n',
  )

  console.error(
    error,
  )

  process.exit(1)
}