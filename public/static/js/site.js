const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");

if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
        navMenu.classList.toggle("is-open");
    });
}

const revealItems = document.querySelectorAll("[data-reveal]");
if (revealItems.length) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.2 }
    );

    revealItems.forEach((item) => observer.observe(item));
}

document.querySelectorAll("[data-count]").forEach((counter) => {
    const target = Number(counter.dataset.count || "0");
    const duration = 1200;
    const started = { value: false };

    const animate = () => {
        if (started.value) {
            return;
        }
        started.value = true;
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            counter.textContent = String(Math.floor(progress * target));
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                counter.textContent = String(target);
            }
        };

        requestAnimationFrame(tick);
    };

    const watcher = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                animate();
                watcher.disconnect();
            }
        });
    });

    watcher.observe(counter);
});

const floatCard = document.querySelector("[data-float-card]");
if (floatCard) {
    window.addEventListener("mousemove", (event) => {
        const x = (event.clientX / window.innerWidth - 0.5) * 12;
        const y = (event.clientY / window.innerHeight - 0.5) * -12;
        floatCard.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
}
