import { createSelector } from '@reduxjs/toolkit';
import { sortBy } from 'lodash';
import { BeefyState } from '../../../redux-types';
import { isGovVault, isVaultRetired, VaultEntity } from '../entities/vault';
import {
  selectHasUserDepositInVault,
  selectIsUserEligibleForVault,
  selectUserVaultDepositInUsd,
  selectUserVaultDepositTokenWalletBalanceInUsd,
} from './balance';
import {
  selectBoostById,
  selectIsVaultBoosted,
  selectIsVaultPreStakedOrBoosted,
  selectPreStakeOrActiveBoostIds,
} from './boosts';
import { selectIsVaultMoonpot } from './partners';
import {
  selectIsVaultBeefy,
  selectIsVaultBlueChip,
  selectIsVaultFeatured,
  selectIsVaultStable,
  selectVaultById,
} from './vaults';
import escapeStringRegexp from 'escape-string-regexp';
import { selectTokenByAddress } from './tokens';
import { createCachedSelector } from 're-reselect';
import { KeysOfType } from '../utils/types-utils';
import { FilteredVaultsState } from '../reducers/filtered-vaults';

export const selectFilterOptions = (state: BeefyState) => state.ui.filteredVaults;

export const selectFilterSearchText = (state: BeefyState) => state.ui.filteredVaults.searchText;
export const selectFilterChainIds = (state: BeefyState) => state.ui.filteredVaults.chainIds;
export const selectFilterSearchSortField = (state: BeefyState) => state.ui.filteredVaults.sort;
export const selectFilterSearchSortDirection = (state: BeefyState) =>
  state.ui.filteredVaults.sortDirection;
export const selectFilterUserCategory = (state: BeefyState) => state.ui.filteredVaults.userCategory;
export const selectFilterVaultType = (state: BeefyState) => state.ui.filteredVaults.vaultType;
export const selectFilterVaultCategory = (state: BeefyState) =>
  state.ui.filteredVaults.vaultCategory;
export const selectFilterPlatformId = (state: BeefyState) => state.ui.filteredVaults.platformId;

export const selectFilterBoolean = createCachedSelector(
  (state: BeefyState, key: KeysOfType<FilteredVaultsState, boolean>) => key,
  (state: BeefyState) => state.ui.filteredVaults,
  (key, filters) => filters[key]
)((state: BeefyState, key: KeysOfType<FilteredVaultsState, boolean>) => key);

export const selectFilterPopinFilterCount = createSelector(
  selectFilterOptions,
  filterOptions =>
    (filterOptions.onlyRetired ? 1 : 0) +
    (filterOptions.onlyMoonpot ? 1 : 0) +
    (filterOptions.onlyBoosted ? 1 : 0) +
    (filterOptions.platformId !== null ? 1 : 0) +
    (filterOptions.vaultType !== 'all' ? 1 : 0) +
    (filterOptions.vaultCategory !== 'all' ? 1 : 0) +
    (filterOptions.sort !== 'default' ? 1 : 0) +
    filterOptions.chainIds.length
);

export const selectHasActiveFilter = createSelector(
  selectFilterOptions,
  filterOptions =>
    filterOptions.vaultCategory !== 'all' ||
    filterOptions.userCategory !== 'all' ||
    filterOptions.vaultType !== 'all' ||
    filterOptions.onlyRetired !== false ||
    filterOptions.onlyMoonpot !== false ||
    filterOptions.onlyBoosted !== false ||
    filterOptions.searchText !== '' ||
    filterOptions.platformId !== null ||
    filterOptions.sort !== 'default' ||
    filterOptions.chainIds.length > 0
);

export const selectHasActiveFilterExcludingUserCategoryAndSort = createSelector(
  selectFilterOptions,
  filterOptions =>
    filterOptions.vaultCategory !== 'all' ||
    filterOptions.vaultType !== 'all' ||
    filterOptions.onlyRetired !== false ||
    filterOptions.onlyMoonpot !== false ||
    filterOptions.onlyBoosted !== false ||
    filterOptions.searchText !== '' ||
    filterOptions.platformId !== null ||
    filterOptions.chainIds.length > 0
);

export const selectVaultCategory = createSelector(
  selectFilterOptions,
  filterOptions => filterOptions.vaultCategory
);

function simplifySearchText(text: string) {
  return (text || '').replace(/-/g, ' ').trim();
}

function safeSearchRegex(needle: string, caseInsensitive: boolean = true) {
  const modifiers = `g${caseInsensitive ? 'i' : ''}`;
  return new RegExp(escapeStringRegexp(needle), modifiers);
}

// TOKEN, WTOKEN or TOKENW
function fuzzyTokenRegex(token: string) {
  return new RegExp(`^w?${escapeStringRegexp(token)}w?$`, 'gi');
}

function stringFoundAnywhere(haystack: string, needle: string, caseInsensitive: boolean = true) {
  return (haystack || '').match(safeSearchRegex(needle, caseInsensitive));
}

function vaultNameMatches(vault: VaultEntity, searchText: string) {
  return stringFoundAnywhere(simplifySearchText(vault.name), searchText);
}

function searchTextToFuzzyTokenMatchers(searchText: string) {
  return searchText
    .split(/[- /,]/g)
    .map(t => t.trim())
    .filter(t => t.length > 1)
    .map(t => fuzzyTokenRegex(t));
}

function selectVaultMatchesText(state: BeefyState, vault: VaultEntity, searchText: string) {
  // Do not match on single characters
  if (searchText.length < 2) {
    return false;
  }

  // Match if: search text is in vault name
  if (vaultNameMatches(vault, searchText)) {
    return true;
  }

  // Split search text in to possible tokens
  const fuzzySearchTokens = searchTextToFuzzyTokenMatchers(searchText);

  // No token names in search string
  if (fuzzySearchTokens.length === 0) {
    return false;
  }

  // All tokens must match
  return fuzzySearchTokens.every(token => {
    // In vault assets
    if (vault.assetIds.some(assetId => assetId.match(token))) {
      return true;
    }

    // In gov earned token
    if (
      isGovVault(vault) &&
      selectTokenByAddress(state, vault.chainId, vault.earnedTokenAddress).id.match(token)
    ) {
      return true;
    }

    // Boost earned token
    if (selectIsVaultPreStakedOrBoosted(state, vault.id)) {
      const boostAssets = selectPreStakeOrActiveBoostIds(state, vault.id)
        .map(boostId => selectBoostById(state, boostId))
        .map(boost => boost.earnedTokenAddress)
        .map(address => selectTokenByAddress(state, vault.chainId, address))
        .map(token => token.id);

      if (boostAssets.some(assetId => assetId.match(token))) {
        return true;
      }
    }

    // Default: no match
    return false;
  });
}

// todo: use createSelector or put the result in the state to avoid re-computing these on every render
// https://dev.to/nioufe/you-should-not-use-lodash-for-memoization-3441
export const selectFilteredVaults = (state: BeefyState) => {
  const filterOptions = selectFilterOptions(state);
  const vaults = state.entities.vaults.allIds.map(id => selectVaultById(state, id));
  const tvlByVaultId = state.biz.tvl.byVaultId;
  const apyByVaultId = state.biz.apy.totalApy.byVaultId;

  // apply filtering
  const chainIdMap = createIdMap(filterOptions.chainIds);
  const filteredVaults = vaults.filter(vault => {
    if (filterOptions.vaultCategory === 'featured' && !selectIsVaultFeatured(state, vault.id)) {
      return false;
    }
    if (filterOptions.vaultCategory === 'bluechip' && !selectIsVaultBlueChip(state, vault.id)) {
      return false;
    }
    if (filterOptions.vaultCategory === 'stable' && !selectIsVaultStable(state, vault.id)) {
      return false;
    }
    if (filterOptions.vaultCategory === 'beefy' && !selectIsVaultBeefy(state, vault.id)) {
      return false;
    }

    if (filterOptions.chainIds.length > 0 && !chainIdMap[vault.chainId]) {
      return false;
    }
    if (filterOptions.platformId !== null && vault.platformId !== filterOptions.platformId) {
      return false;
    }
    // paused vaults are not considered retired
    if (filterOptions.onlyRetired && !isVaultRetired(vault)) {
      return false;
    }
    if (
      !filterOptions.onlyRetired &&
      isVaultRetired(vault) &&
      filterOptions.userCategory !== 'deposited'
    ) {
      return false;
    }
    if (filterOptions.onlyMoonpot && !selectIsVaultMoonpot(state, vault.id)) {
      return false;
    }
    if (filterOptions.onlyBoosted && !selectIsVaultBoosted(state, vault.id)) {
      return false;
    }

    if (filterOptions.vaultType === 'lps' && vault.type !== 'lps') {
      return false;
    }
    if (filterOptions.vaultType === 'single' && vault.type !== 'single') {
      return false;
    }

    // hide when no wallet balance of deposit token
    if (
      filterOptions.userCategory === 'eligible' &&
      !selectIsUserEligibleForVault(state, vault.id)
    ) {
      return false;
    }

    if (
      filterOptions.userCategory === 'deposited' &&
      !selectHasUserDepositInVault(state, vault.id)
    ) {
      return false;
    }

    // If the user's included a search string...
    const searchText = simplifySearchText(filterOptions.searchText);
    if (searchText.length > 0 && !selectVaultMatchesText(state, vault, searchText)) {
      return false;
    }

    return true;
  });

  // apply sort
  let sortedVaults = filteredVaults;

  if (filterOptions.sort === 'default') {
    // Vaults are already presorted by date on the reducer
    // TODO find all boosted and bring to top rather than sort whole array?
    // TODO explore having separate component to render boosted on top so list doesn't jump on load (downside: dups)
    sortedVaults = sortBy(sortedVaults, vault =>
      selectIsVaultPreStakedOrBoosted(state, vault.id) && vault.platformId !== 'valleyswap' ? -1 : 1
    );
  }

  const sortDirMul = filterOptions.sortDirection === 'desc' ? -1 : 1;
  if (filterOptions.sort === 'apy') {
    sortedVaults = sortBy(sortedVaults, vault => {
      const apy = apyByVaultId[vault.id];
      if (!apy) {
        return 0;
      }

      if (apy.boostedTotalApy !== undefined) {
        return sortDirMul * apy.boostedTotalApy;
      } else if (apy.totalApy !== undefined) {
        return sortDirMul * apy.totalApy;
      } else if (apy.vaultApr !== undefined) {
        return sortDirMul * apy.vaultApr;
      } else {
        throw new Error('Apy type not supported');
      }
    });
  } else if (filterOptions.sort === 'daily') {
    sortedVaults = sortBy(sortedVaults, vault => {
      const apy = apyByVaultId[vault.id];
      if (!apy) {
        return 0;
      }

      if (apy.boostedTotalDaily !== undefined) {
        return sortDirMul * apy.boostedTotalDaily;
      } else if (apy.totalDaily !== undefined) {
        return sortDirMul * apy.totalDaily;
      } else if (apy.vaultDaily !== undefined) {
        return sortDirMul * apy.vaultDaily;
      } else {
        throw new Error('Daily type not supported');
      }
    });
  } else if (filterOptions.sort === 'tvl') {
    sortedVaults = sortBy(sortedVaults, vault => {
      const tvl = tvlByVaultId[vault.id];
      if (!tvl) {
        return 0;
      }
      return sortDirMul * tvl.tvl.toNumber();
    });
  } else if (filterOptions.sort === 'safetyScore') {
    sortedVaults = sortBy(sortedVaults, vault => {
      return sortDirMul * vault.safetyScore;
    });
  } else if (filterOptions.sort === 'depositValue') {
    sortedVaults = sortBy(sortedVaults, vault => {
      const balance = selectUserVaultDepositInUsd(state, vault.id);
      return sortDirMul * balance.toNumber();
    });
  } else if (filterOptions.sort === 'walletValue') {
    sortedVaults = sortBy(sortedVaults, vault => {
      const balance = selectUserVaultDepositTokenWalletBalanceInUsd(state, vault.id);
      return sortDirMul * balance.toNumber();
    });
  }

  return sortedVaults.map(vault => vault.id);
};

export const selectFilteredVaultCount = createSelector(selectFilteredVaults, ids => ids.length);

export const selectTotalVaultCount = createSelector(
  (state: BeefyState) => state.entities.vaults.allIds.length,
  c => c
);

function createIdMap(ids: string[]) {
  const map = {};
  for (const id of ids) {
    map[id] = true;
  }
  return map;
}
