import type { Container } from "../../Core/Container";
import type { Particle } from "../../Core/Particle";
import { Circle, CircleWarp, ColorUtils, Constants, Utils } from "../../Utils";
import type { IParticlesInteractor } from "../../Core/Interfaces/IParticlesInteractor";
import { IParticle } from "../../Core/Interfaces/IParticle";

export class Linker implements IParticlesInteractor {
    constructor(private readonly container: Container) {}

    public isEnabled(particle: Particle): boolean {
        return particle.particlesOptions.links.enable;
    }

    public reset(): void {
        // do nothing
    }

    public interact(p1: Particle): void {
        const container = this.container;
        const linkOpt1 = p1.particlesOptions.links;
        const optOpacity = linkOpt1.opacity;
        const optDistance = p1.linksDistance ?? container.retina.linksDistance;
        const canvasSize = container.canvas.size;
        const warp = linkOpt1.warp;
        const pos1 = p1.getPosition();

        //const query = container.particles.spatialGrid.queryRadiusWithDistance(pos1, optDistance + 10);
        const range = warp
            ? new CircleWarp(pos1.x, pos1.y, optDistance, canvasSize)
            : new Circle(pos1.x, pos1.y, optDistance);

        const query = container.particles.quadTree.query(range);

        const p1Links = container.particles.getLinks(p1);

        for (const link of p1Links.filter((l) => !l.edges.some((t) => (query as IParticle[]).includes(t)))) {
            container.particles.removeExactLink(link);
        }

        //for (const { distance, p2 } of query) {
        for (const p2 of query) {
            const linkOpt2 = p2.particlesOptions.links;

            if (p1 === p2) {
                continue;
            }

            const index = container.particles.findLinkIndex(p1, p2);

            if (!linkOpt2.enable || linkOpt1.id !== linkOpt2.id || p2.destroyed || p2.spawning) {
                if (!linkOpt2.enable || p2.destroyed || p2.spawning) {
                    container.particles.removeLinks(p2);
                }

                if (index >= 0) {
                    container.particles.links.splice(index, 0);
                }

                continue;
            }

            const pos2 = p2.getPosition();

            let distance = Utils.getDistance(pos1, pos2);

            if (warp) {
                if (distance > optDistance) {
                    const pos2NE = {
                        x: pos2.x - canvasSize.width,
                        y: pos2.y,
                    };

                    distance = Utils.getDistance(pos1, pos2NE);

                    if (distance > optDistance) {
                        const pos2SE = {
                            x: pos2.x - canvasSize.width,
                            y: pos2.y - canvasSize.height,
                        };

                        distance = Utils.getDistance(pos1, pos2SE);

                        if (distance > optDistance) {
                            const pos2SW = {
                                x: pos2.x,
                                y: pos2.y - canvasSize.height,
                            };

                            distance = Utils.getDistance(pos1, pos2SW);
                        }
                    }
                }
            }

            /* draw a line between p1 and p2 */
            const opacityLine = optOpacity - (distance * optOpacity) / optDistance;

            if (opacityLine <= 0) {
                if (index >= 0) {
                    container.particles.removeLinkAtIndex(index);
                }
            } else {
                if (index >= 0) {
                    if (index >= 0) {
                        container.particles.links[index].opacity = opacityLine;
                    }
                } else {
                    /* style */
                    const linksOptions = p1.particlesOptions.links;

                    let linkColor =
                        linksOptions.id !== undefined
                            ? container.particles.linksColors.get(linksOptions.id)
                            : container.particles.linksColor;

                    if (!linkColor) {
                        const optColor = linksOptions.color;
                        const color = typeof optColor === "string" ? optColor : optColor.value;

                        /* particles.line_linked - convert hex colors to rgb */
                        //  check for the color profile requested and
                        //  then return appropriate value

                        if (color === Constants.randomColorValue) {
                            if (linksOptions.consent) {
                                linkColor = ColorUtils.colorToRgb({
                                    value: color,
                                });
                            } else if (linksOptions.blink) {
                                linkColor = Constants.randomColorValue;
                            } else {
                                linkColor = Constants.midColorValue;
                            }
                        } else {
                            linkColor = ColorUtils.colorToRgb({
                                value: color,
                            });
                        }

                        if (linksOptions.id !== undefined) {
                            container.particles.linksColors.set(linksOptions.id, linkColor);
                        } else {
                            container.particles.linksColor = linkColor;
                        }
                    }

                    const link = container.particles.addLink(p1, p2);

                    link.opacity = opacityLine;
                }
            }
        }

        const pTriangles = p1.particlesOptions.links.triangles;

        if (pTriangles.enable) {
            this.updateTriangles(p1);
        }
    }

    private updateTriangles(p1: Particle): void {
        const container = this.container;

        const p1Links = container.particles.getLinks(p1);
        const p1OldTriangles = container.particles.triangles.filter((t) => t.vertices.includes(p1));

        for (const triangle of p1OldTriangles.filter((t) =>
            t.vertices.some((v) => !p1Links.some((l) => l.edges.includes(v)))
        )) {
            const index = container.particles.triangles.indexOf(triangle);

            container.particles.triangles.splice(index, 1);
        }

        for (const sourceLink of p1Links) {
            const p1Index = sourceLink.edges.indexOf(p1);
            const p2 = sourceLink.edges[(p1Index + 1) % 2];
            const p2Links = container.particles.getLinks(p2);
            const p2OldTriangles = container.particles.triangles.filter((t) => t.vertices.includes(p2));

            for (const triangle of p2OldTriangles.filter((t) =>
                t.vertices.some((v) => !p2Links.some((l) => l.edges.includes(v)))
            )) {
                const index = container.particles.triangles.indexOf(triangle);

                container.particles.triangles.splice(index, 1);
            }

            for (const destinationLink of p2Links.filter((l) => !l.edges.includes(p1))) {
                const p2Index = sourceLink.edges.indexOf(p2);
                const p3 = destinationLink.edges[(p2Index + 1) % 2];
                const p3Links = container.particles.getLinks(p3);
                const p3OldTriangles = container.particles.triangles.filter((t) => t.vertices.includes(p3));

                for (const triangle of p3OldTriangles.filter((t) =>
                    t.vertices.some((v) => !p3Links.some((l) => l.edges.includes(v)))
                )) {
                    const index = container.particles.triangles.indexOf(triangle);

                    container.particles.triangles.splice(index, 1);
                }

                if (p3Links.find((l) => l.edges.includes(p1))) {
                    if (
                        !container.particles.triangles.find(
                            (t) => t.vertices.includes(p1) && t.vertices.includes(p2) && t.vertices.includes(p3)
                        )
                    ) {
                        container.particles.triangles.push({
                            vertices: [p1, p2, p3],
                            opacity: p1.particlesOptions.links.triangles.opacity ?? p1.particlesOptions.links.opacity,
                        });
                    }
                }
            }
        }
    }
}
