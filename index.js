const username = "inpercima";
let allRepos = [];

async function fetchRepos() {
  const response = await fetch(
  `https://api.github.com/users/${username}/repos?per_page=100`,
  {
    headers: {
      Accept: "application/vnd.github+json"
    }
  }
);

  const data = await response.json();

  allRepos = data
    .filter(repo => !repo.fork)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  renderRepos(allRepos);
}

function renderRepos(repos) {
  const table = document.getElementById("repoTable");
  table.innerHTML = "";

  repos.forEach(repo => {
    const row = document.createElement("tr");
    row.className = "border-b border-slate-800 hover:bg-slate-900";

    const topics = repo.topics
      .map(topic =>
        `<span class="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs mr-1">${topic}</span>`
      )
      .join("");

    row.innerHTML = `
      <td class="py-4 font-medium">
        <a href="${repo.html_url}" target="_blank" class="hover:text-blue-400">
          ${repo.name}
        </a>
      </td>
      <td>${repo.language ?? "-"}</td>
      <td>${topics}</td>
      <td>${repo.stargazers_count}</td>
      <td>${repo.updated_at.split("T")[0]}</td>
    `;

    table.appendChild(row);
  });
}

document.getElementById("filterInput").addEventListener("input", e => {
  const value = e.target.value.toLowerCase();

  if (!value) {
    renderRepos(allRepos);
    return;
  }

  const filtered = allRepos.filter(repo =>
    repo.topics.some(topic => topic.includes(value))
  );

  renderRepos(filtered);
});

fetchRepos();
