#!/bin/bash -e

if [[ " $@ " =~ " -h " ]] || [[ " $@ " =~ " --help " ]]; then
  echo "Usage:"
  echo "  ./scripts/run.sh <query>     Search across all sources"
  echo "  ./scripts/run.sh ln <query>  Search or create Linear issues"
  echo "  ./scripts/run.sh gh <query>  Search GitHub pull requests" 
  echo "  ./scripts/run.sh vc <query>  Search Vercel deployments"
  echo "  ./scripts/run.sh vc env <prod|dev|preview>  Get Vercel environment variables"
  echo "  ./scripts/run.sh fg <query>  Search Figma comments"
  echo "  ./scripts/run.sh lm <query>  Search Loom videos"
  exit 1
fi

format_results() {
  local json="$1"
  local limit=4
  echo "$json" | node -e "
    const results = JSON.parse(require('fs').readFileSync(0, 'utf-8'))
      .items.slice(0, $limit)
      .map((x) => [${@:2}].join('\n'))
      .join('\n\n')
    console.log(results);
  "
}

node scripts/generate-env.js --quiet 
set -o allexport
source .env
set +o allexport

# Handle Vercel environment variables
if [ "$1" = "vc" ] && [ "$2" = "env" ]; then
  ENV_QUERY="${3:-}"
  RESULTS=$(node src/vercel-get-env.js "$ENV_QUERY")

  # Check if results are environment options vs actual variables
  if echo "$RESULTS" | jq -e '.items | length > 1' > /dev/null 2>&1; then
    # Show environment selection options
    echo "Usage: ./scripts/run.sh vc env <prod|dev|preview>"
    echo ""
    format_results "$RESULTS" "x.title, x.subtitle"
  else
    # Handle environment variables
    ENV_CONTENT=$(echo "$RESULTS" | jq -r '.items[0].arg')
    format_results "$RESULTS" "x.title, x.subtitle"
    read -p "Confirm? (y/N) " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
      echo "$ENV_CONTENT" | pbcopy
      echo "✅ Copied to clipboard, you can paste it into your .env file"
    fi
  fi
  exit 0
fi

# Run root filter first
RESULTS=$(node src/root-filter.js "$@")

if [ "$1" = "ln" ]; then
  ITEMS_COUNT=$(echo "$RESULTS" | jq '.items | length')

  if [ "$ITEMS_COUNT" -eq 0 ]; then
    # No results found, try create issue filter
    CREATE_RESULTS=$(node src/create-linear-issue-filter.js "${@:2}")
    format_results "$CREATE_RESULTS" "x.title, x.subtitle"

    read -p "Commit? (y/N) " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
      node src/create-linear-issue-mutation.js "${@:2}"
    fi
    exit 0
  fi
fi

# Display root filter results
format_results "$RESULTS" "x.title, x.subtitle, x.arg"
