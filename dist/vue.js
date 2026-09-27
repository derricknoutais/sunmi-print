var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { defineComponent, h, onMounted, ref, watch } from 'vue';
import { apercuRecu, etatImprimante, imprimerRecu } from "./imprimer.js";
/**
 * Imprimer depuis un composant Vue 3.
 *
 * Une simple enveloppe : tout vit dans `imprimerRecu`, `etatImprimante` et
 * `apercuRecu`, utilisables tels quels en Vue 2, Alpine ou sans framework.
 */
export function useImprimante(options = {}) {
    const etat = ref(null);
    const enCours = ref(false);
    const erreur = ref(null);
    function detecter() {
        return __awaiter(this, void 0, void 0, function* () {
            etat.value = yield etatImprimante(options);
            return etat.value;
        });
    }
    function imprimer(recu_1) {
        return __awaiter(this, arguments, void 0, function* (recu, autres = {}) {
            // Un double appui ne doit pas sortir deux reçus.
            if (enCours.value)
                return false;
            enCours.value = true;
            erreur.value = null;
            try {
                yield imprimerRecu(recu, Object.assign(Object.assign({}, options), autres));
                return true;
            }
            catch (e) {
                erreur.value = e instanceof Error ? e.message : String(e);
                return false;
            }
            finally {
                enCours.value = false;
                // L'état a pu changer : papier épuisé, capot ouvert…
                detecter().catch(() => undefined);
            }
        });
    }
    // Pas de détection par défaut : sur un Chrome de bureau récent, interroger
    // 127.0.0.1 depuis un site public peut déclencher une demande d'accès au
    // réseau local. On détecte quand on imprime, ou quand on le demande.
    if (options.detecterAuMontage)
        onMounted(() => detecter().catch(() => undefined));
    return { etat, enCours, erreur, imprimer, detecter };
}
/**
 * L'aperçu d'un reçu, pixel pour pixel ce qui sortira de l'imprimante.
 *
 *   <ApercuRecu :recu="recu" />
 */
export const ApercuRecu = defineComponent({
    name: 'ApercuRecu',
    props: {
        recu: { type: Object, required: true },
        /** En points ; 384 (58 mm) par défaut. */
        largeur: { type: Number, default: undefined },
    },
    setup(props) {
        const conteneur = ref(null);
        const erreur = ref(null);
        let tour = 0;
        function rendre() {
            return __awaiter(this, void 0, void 0, function* () {
                // Un rendu plus récent l'emporte, même s'il finit avant l'ancien.
                const moi = ++tour;
                try {
                    const toile = (yield apercuRecu(props.recu, { largeur: props.largeur }));
                    const cible = conteneur.value;
                    if (moi !== tour || !cible)
                        return;
                    toile.style.display = 'block';
                    toile.style.width = '100%';
                    toile.style.maxWidth = `${toile.width}px`;
                    // Réduit à l'écran, un aperçu lissé mentirait : il montrerait du gris.
                    toile.style.imageRendering = 'pixelated';
                    while (cible.firstChild)
                        cible.removeChild(cible.firstChild);
                    cible.appendChild(toile);
                    erreur.value = null;
                }
                catch (e) {
                    if (moi === tour)
                        erreur.value = e instanceof Error ? e.message : String(e);
                }
            });
        }
        onMounted(rendre);
        watch(() => [props.recu, props.largeur], rendre, { deep: true });
        return () => h('div', { class: 'apercu-recu' }, [
            h('div', { ref: conteneur }),
            erreur.value ? h('p', { class: 'apercu-recu__erreur', role: 'alert' }, erreur.value) : null,
        ]);
    },
});
