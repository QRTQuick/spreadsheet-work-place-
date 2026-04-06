const authForms = document.querySelectorAll("[data-auth-form]");

authForms.forEach((form) => {
    const message = form.querySelector("[data-form-message]");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const endpoint = form.dataset.endpoint;
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        if (message) {
            message.textContent = "Submitting…";
            message.className = "form-message";
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error || "Unable to submit the form.");
            }

            if (message) {
                message.textContent = "Success. Redirecting…";
                message.className = "form-message is-success";
            }

            window.location.href = data.redirect;
        } catch (error) {
            if (message) {
                message.textContent = error.message;
                message.className = "form-message is-error";
            }
        }
    });
});
