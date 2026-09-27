import { defineComponent, h, onMounted, ref, watch, type PropType, type Ref } from 'vue';
import type { Recu } from './document.ts';
import type { EtatImprimante } from './etat.ts';
import { apercuRecu, etatImprimante, imprimerRecu, type OptionsImpression } from './imprimer.ts';
import type { OptionsServeur } from './serveur.ts';

/**
 * Imprimer depuis un composant Vue 3.
 *
 * Une simple enveloppe : tout vit dans `imprimerRecu`, `etatImprimante` et
 * `apercuRecu`, utilisables tels quels en Vue 2, Alpine ou sans framework.
 */
export function useImprimante(options: OptionsServeur & { detecterAuMontage?: boolean } = {}): {
    /** Le dernier état connu ; `null` tant que rien n'a été détecté. */
    etat: Ref<EtatImprimante | null>;
    enCours: Ref<boolean>;
    /** Message de la dernière erreur, prêt à afficher ; `null` après un succès. */
    erreur: Ref<string | null>;
    /** Se résout à `true` si le reçu est sorti. Un second appel pendant l'impression est ignoré. */
    imprimer: (recu: Recu, autres?: OptionsImpression) => Promise<boolean>;
    detecter: () => Promise<EtatImprimante>;
} {
    const etat = ref<EtatImprimante | null>(null);
    const enCours = ref(false);
    const erreur = ref<string | null>(null);

    async function detecter(): Promise<EtatImprimante> {
        etat.value = await etatImprimante(options);
        return etat.value;
    }

    async function imprimer(recu: Recu, autres: OptionsImpression = {}): Promise<boolean> {
        // Un double appui ne doit pas sortir deux reçus.
        if (enCours.value) return false;
        enCours.value = true;
        erreur.value = null;
        try {
            await imprimerRecu(recu, { ...options, ...autres });
            return true;
        } catch (e) {
            erreur.value = e instanceof Error ? e.message : String(e);
            return false;
        } finally {
            enCours.value = false;
            // L'état a pu changer : papier épuisé, capot ouvert…
            detecter().catch(() => undefined);
        }
    }

    // Pas de détection par défaut : sur un Chrome de bureau récent, interroger
    // 127.0.0.1 depuis un site public peut déclencher une demande d'accès au
    // réseau local. On détecte quand on imprime, ou quand on le demande.
    if (options.detecterAuMontage) onMounted(() => detecter().catch(() => undefined));

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
        recu: { type: Object as PropType<Recu>, required: true },
        /** En points ; 384 (58 mm) par défaut. */
        largeur: { type: Number, default: undefined },
    },
    setup(props) {
        const conteneur = ref<HTMLElement | null>(null);
        const erreur = ref<string | null>(null);
        let tour = 0;

        async function rendre(): Promise<void> {
            // Un rendu plus récent l'emporte, même s'il finit avant l'ancien.
            const moi = ++tour;
            try {
                const toile = (await apercuRecu(props.recu, { largeur: props.largeur })) as HTMLCanvasElement;
                const cible = conteneur.value;
                if (moi !== tour || !cible) return;

                toile.style.display = 'block';
                toile.style.width = '100%';
                toile.style.maxWidth = `${toile.width}px`;
                // Réduit à l'écran, un aperçu lissé mentirait : il montrerait du gris.
                toile.style.imageRendering = 'pixelated';
                while (cible.firstChild) cible.removeChild(cible.firstChild);
                cible.appendChild(toile);
                erreur.value = null;
            } catch (e) {
                if (moi === tour) erreur.value = e instanceof Error ? e.message : String(e);
            }
        }

        onMounted(rendre);
        watch(() => [props.recu, props.largeur], rendre, { deep: true });

        return () =>
            h('div', { class: 'apercu-recu' }, [
                h('div', { ref: conteneur }),
                erreur.value ? h('p', { class: 'apercu-recu__erreur', role: 'alert' }, erreur.value) : null,
            ]);
    },
});
