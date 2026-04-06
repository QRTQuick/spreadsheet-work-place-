const dashboardNode = document.getElementById("dashboard-data");

if (dashboardNode) {
    const bootstrap = JSON.parse(dashboardNode.textContent);
    const workspaceList = document.querySelector("[data-workspace-list]");
    const activityList = document.querySelector("[data-activity-list]");
    const workspaceForm = document.querySelector("[data-workspace-form]");
    const workspaceMessage = document.querySelector("[data-workspace-message]");
    const totalWorkspaces = document.querySelector("[data-total-workspaces]");
    const totalEvents = document.querySelector("[data-total-events]");
    const logoutButton = document.querySelector("[data-logout-button]");

    let workspaces = bootstrap.workspaces || [];
    let events = bootstrap.events || [];

    const formatDate = (value) => {
        if (!value) return "Just now";
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(value));
    };

    const renderWorkspaces = () => {
        totalWorkspaces.textContent = String(workspaces.length);
        if (!workspaceList) return;

        if (!workspaces.length) {
            workspaceList.innerHTML = `
                <article class="workspace-card">
                    <strong>No workspaces yet</strong>
                    <p>Create your first spreadsheet workspace to start editing data.</p>
                </article>
            `;
            return;
        }

        workspaceList.innerHTML = "";
        workspaces.forEach((workspace) => {
            const card = document.createElement("article");
            card.className = "workspace-card";

            const top = document.createElement("div");
            top.className = "workspace-card-top";

            const copy = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = workspace.name;
            const description = document.createElement("p");
            description.textContent = workspace.description || "Private spreadsheet environment.";
            copy.append(title, description);

            const sizePill = document.createElement("span");
            sizePill.className = "mini-pill";
            sizePill.textContent = `${workspace.sheet.row_count}x${workspace.sheet.col_count}`;
            top.append(copy, sizePill);

            const footer = document.createElement("div");
            footer.className = "workspace-card-footer";

            const updated = document.createElement("span");
            updated.className = "pill";
            updated.textContent = formatDate(workspace.updated_at);

            const actions = document.createElement("div");
            actions.className = "hero-actions";

            const download = document.createElement("a");
            download.className = "button button-secondary slim";
            download.href = `/api/workspaces/${workspace.id}/export.csv`;
            download.textContent = "Download";

            const open = document.createElement("a");
            open.className = "button button-primary slim";
            open.href = `/workspace/${workspace.slug}`;
            open.textContent = "Open";

            actions.append(download, open);
            footer.append(updated, actions);
            card.append(top, footer);
            workspaceList.appendChild(card);
        });
    };

    const renderEvents = () => {
        totalEvents.textContent = String(events.length);
        if (!activityList) return;

        if (!events.length) {
            activityList.innerHTML = `
                <article class="activity-item">
                    <strong>No recent activity</strong>
                    <p>Your workspace actions will show up here.</p>
                </article>
            `;
            return;
        }

        activityList.innerHTML = "";
        events.forEach((item) => {
            const card = document.createElement("article");
            card.className = "activity-item";

            const title = document.createElement("strong");
            title.textContent = item.action.replace(".", " ");

            const detail = document.createElement("p");
            detail.textContent = item.detail;

            const timestamp = document.createElement("span");
            timestamp.className = "pill";
            timestamp.textContent = formatDate(item.created_at);

            card.append(title, detail, timestamp);
            activityList.appendChild(card);
        });
    };

    renderWorkspaces();
    renderEvents();

    workspaceForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(workspaceForm).entries());
        workspaceMessage.textContent = "Creating workspace…";
        workspaceMessage.className = "form-message";

        try {
            const response = await fetch("/api/workspaces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error || "Unable to create workspace.");
            }

            workspaceMessage.textContent = "Workspace ready. Redirecting…";
            workspaceMessage.className = "form-message is-success";
            window.location.href = data.redirect;
        } catch (error) {
            workspaceMessage.textContent = error.message;
            workspaceMessage.className = "form-message is-error";
        }
    });

    logoutButton?.addEventListener("click", async () => {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        const data = await response.json();
        window.location.href = data.redirect || "/";
    });
}
