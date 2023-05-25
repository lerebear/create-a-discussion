const core = require('@actions/core')
const { Toolkit } = require("actions-toolkit")
const { graphql } = require("@octokit/graphql")
const moment = require("moment")

const main = async () => {
  const authToken = "token " + process.env.DISCUSSIONS_TOKEN

  const repository = await getRepositoryData(authToken)
  const discussionBody = await buildDiscussionBody()
  const discussionTitle = buildDiscussionTitle()

  const categoryName = core.getInput("category") || "General"
  const category = repository.discussionCategories.nodes.find(c => c.name === categoryName)
  core.debug(`Searching for ${categoryName} in ${repository.discussionCategories.nodes.map(c => c.name)}, found ${category}`)

  await createDiscussion(authToken, discussionBody, discussionTitle, repository.id, category.id)
}

const getRepositoryData = async (authToken) => {
  core.debug(`Querying repository ${process.env.GITHUB_REPOSITORY}`)
  const repositoryArray = process.env.GITHUB_REPOSITORY.split("/")

  const { repository } = await graphql(
    `
      query repositoryId($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
          discussionCategories(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
    {
      owner: repositoryArray[0],
      name: repositoryArray[1],
      headers: {
        authorization: authToken,
        "GraphQL-Features": "discussions_api",
      },
    }
  )

  return repository
}

const readTemplateFile = async () => {
  core.debug("read-template-file")
  const template = core.getInput("filename") || "./.github/DISCUSSION_TEMPLATE.md"

  core.debug(`Reading template file: ${template}`)
  const tools = new Toolkit()
  const content = await tools.readFile(template)
  return content
}

const buildDiscussionBody = async () => {
  core.debug("discussion-body");
  const discussionBody = core.getInput("discussion-body");
  if(discussionBody) {
    return discussionBody;
  } else {
    return await readTemplateFile();
  }
}

const buildDiscussionTitle = () => {
    core.debug("discussion-title")
  const titleText = core.getInput("title")

  if (core.getInput("title-date") === "true") {
    const date = moment().format("dddd, MMMM Do, YYYY")
    return `${titleText} ${date}`
  } else {
    return titleText
  }
}

const createDiscussion = async (authToken, body, title, repositoryId, categoryId) => {
  core.debug(`Creating discussion ${title}`)
  await graphql(
    `
      mutation createDiscussion($input: CreateDiscussionInput!) {
        createDiscussion(input: $input) {
          discussion {
            url
          }
        }
      }
    `,
    {
      input: {
        body: body,
        title: title,
        repositoryId: repositoryId,
        categoryId: categoryId,
      },
      headers: {
        authorization: authToken,
        "GraphQL-Features": "discussions_api",
      },
    }
  )
}

main().catch(err => core.setFailed(err.message))
