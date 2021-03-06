import { Dispatch } from 'redux';
import { ApiData, GroupIssues, IpInfoData, LocationFetchType,
  CountData } from './../../common/model';
import { getAllIssues, getGroupIssues, getCountData, postBackfillOutcomes } from '../../services/apiServices';
import { setCachedCity, setLocation, setLocationFetchType,
  setSplitDistrict, setUiState } from '../location/index';
import { getLocationByIP, getBrowserGeolocation, GEOLOCATION_TIMEOUT } from '../../services/geolocationServices';
import { issuesActionCreator, groupIssuesActionCreator, callCountActionCreator } from './index';
import { clearContactIndexes } from '../callState/';
import { ApplicationState } from '../root';
import { LocationUiState } from '../../common/model';
import Auth from '../../components/shared/loginUtil';
import { UserContactEvent } from '../userStats';
import { setUploadedActionCreator } from '../userStats/actionCreator';

/**
 * Timer for calling fetchLocationByIP() if
 * fetchBrowserGeolocation() fails or times out.
 */
let setTimeoutHandle; //

export const getIssuesIfNeeded = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    const state: ApplicationState = getState();

    // Only make the api call if it hasn't already been made
    // This method is primarily for when a user has navigated
    // directly to a route with an issue id
    if (!state.remoteDataState.issues || state.remoteDataState.issues.length === 0) {
      const loc = state.locationState.address;
      if (loc) {
        // console.log('Using cached address');
        dispatch(fetchAllIssues(loc))
        .then(() => {
          setLocationFetchType(LocationFetchType.CACHED_ADDRESS);
        });
      }
    }
  };
};

export const getGroupIssuesIfNeeded = (groupid: string) => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    const state: ApplicationState = getState();
    // Only make the api call if it hasn't already been made
    // This method is primarily for when a user has navigated
    // directly to a route with an issue id
    if (!state.remoteDataState.groupIssues || state.remoteDataState.groupIssues.length === 0 ||
        state.remoteDataState.currentGroupId !== groupid) {
      const loc = state.locationState.address;
      if (loc) {
        dispatch(fetchGroupIssues(groupid, loc));
      }
    }
  };
};

export const fetchAllIssues = (address: string = '') => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    return getAllIssues(address)
      .then((response: ApiData) => {
        if (response.invalidAddress) {
          dispatch(setUiState(LocationUiState.LOCATION_ERROR));
          Promise.reject('Invalid address found');
        } else {
          const normalizedAddress = response.normalizedLocation as string;
          dispatch(setCachedCity(normalizedAddress));
          dispatch(setLocation(address));
          if (!address) {
            dispatch(setUiState(LocationUiState.LOCATION_ERROR));
          }
          dispatch(setSplitDistrict(response.splitDistrict));
          dispatch(setLocationFetchType(LocationFetchType.CACHED_ADDRESS));
          dispatch(issuesActionCreator(response.issues));
        }
      }).catch((error) => {
        // dispatch(apiErrorMessageActionCreator(error.message));
        // tslint:disable-next-line:no-console
        console.error(`getIssue error: ${error.message}`, error);
        // throw error;
        Promise.reject(error);
      });
  };
};

export const fetchGroupIssues = (groupid: string, address: string = '') => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    return getGroupIssues(groupid, address)
      .then((response: GroupIssues) => {
        if (response.invalidAddress) {
          dispatch(setUiState(LocationUiState.LOCATION_ERROR));
          Promise.reject('Invalid address found');
        } else {
          const normalizedAddress = response.normalizedLocation as string;
          dispatch(setCachedCity(normalizedAddress));
          dispatch(setLocation(address));
          if (!address) {
            dispatch(setUiState(LocationUiState.LOCATION_ERROR));
          }
          dispatch(setSplitDistrict(response.splitDistrict));
          dispatch(setLocationFetchType(LocationFetchType.CACHED_ADDRESS));
          dispatch(groupIssuesActionCreator(response.issues));
        }
      }).catch((error) => {
        // dispatch(apiErrorMessageActionCreator(error.message));
        // tslint:disable-next-line:no-console
        console.error(`getIssue error: ${error.message}`, error);
        // throw error;
        Promise.reject(error);
      });
  };
};

export const fetchCallCount = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    return getCountData()
      .then((response: CountData) => {
        dispatch(callCountActionCreator(response.count));
        // tslint:disable-next-line:no-console
      }).catch((error) => console.error(`fetchCallCount error: ${error.message}`, error));
  };
};

export const fetchDonations = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
      return;
      // return getDonations()
      //   .then((response: DonationGoal) => {
      //     const donations: Donations = response.goal;
      //     dispatch(donationsActionCreator(donations));
      //   })
      //   // tslint:disable-next-line:no-console
      //   .catch(e => console.error(`fetchDonations error: ${e.message}`, e));
  };
};

export const fetchLocationByIP = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    clearTimeout(setTimeoutHandle);
    dispatch(setUiState(LocationUiState.FETCHING_LOCATION));
    return getLocationByIP()
        .then((response: IpInfoData) => {
          dispatch(setLocationFetchType(LocationFetchType.IP_INFO));
          const location = response.loc;
          dispatch(fetchAllIssues(location))
          .then(() => {
            dispatch(setUiState(LocationUiState.LOCATION_FOUND));
          });
          // TODO: dispatch an error message
        }).catch((error) => {
          // tslint:disable-next-line:no-console
          console.error(`fetchLocationByIP error: ${error.message}`, error);
          // set location to empty string to trigger location error
          dispatch(fetchAllIssues(''));
          Promise.resolve('');
        });
    // }
  };
};

export const fetchBrowserGeolocation = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    // Sometimes, the user ignores the prompt or the browser does not
    // provide a response when they do not permit browser location.
    // After GEOLOCATION_TIMEOUT + 1 second, try IP-based location,
    // but let browser-based continue. This timeout is cleared after
    // either geolocation or ipinfo.io location succeeds.
    dispatch(setUiState(LocationUiState.FETCHING_LOCATION));
    const state = getState();
    const fetchType = state.locationState.locationFetchType;
    // const useGeolocation = state.locationState.useGeolocation || null;

    // tslint:disable-next-line:no-shadowed-variable
    setTimeoutHandle = setTimeout(() => dispatch(fetchLocationByIP()), GEOLOCATION_TIMEOUT + 1000);
    // fetchType will be undefined at first
    if (fetchType === undefined || fetchType === LocationFetchType.BROWSER_GEOLOCATION) {
      getBrowserGeolocation()
        .then(location => {
          if (location.latitude && location.longitude) {
            dispatch(setLocationFetchType(LocationFetchType.BROWSER_GEOLOCATION));
            const loc = `${location.latitude} ${location.longitude}`;
            dispatch(fetchAllIssues(loc));
            clearTimeout(setTimeoutHandle);
          } else {
            dispatch(fetchLocationByIP());
          }
        })
        .catch(e => {
          // tslint:disable-next-line:no-console
          console.error('Problem getting browser geolocation', e);
          dispatch(fetchLocationByIP());
        });
    } else {
      dispatch(fetchLocationByIP());
    }
  };
};

export const uploadStatsIfNeeded = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    const state: ApplicationState = getState();

    if (state.userState.idToken) {
      let unuploadedStats: UserContactEvent[] = [];

      for (let i = 0; i < state.userStatsState.all.length; i++) {
        if (!state.userStatsState.all[i].uploaded) {
          unuploadedStats.push(state.userStatsState.all[i]);
          dispatch(setUploadedActionCreator(state.userStatsState.all[i].time));
        }
      }

      if (unuploadedStats.length > 0) {
        postBackfillOutcomes(unuploadedStats, state.userState.idToken);
      }
    }
  };
};

export const startup = () => {
  return (dispatch: Dispatch<ApplicationState>,
          getState: () => ApplicationState) => {
    const state = getState();

    dispatch(setUiState(LocationUiState.FETCHING_LOCATION));
    // clear contact indexes loaded from local storage
    dispatch(clearContactIndexes());

    // check expired login and handle or logout
    const auth = new Auth();
    auth.checkAndRenewSession(state.userState.profile);

    // if a location is passed as a query, override or set the location address manually
    // this will remove hashes, so... don't use them? Or fix this.
    let addressQuery = 'forceAddress';
    let query = window.location.search.substring(1);
    let vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
        let pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) === addressQuery) {
          dispatch(setLocation(pair[1]));
          dispatch(setCachedCity(''));
        }
    }
    window.history.replaceState(null, '', window.location.pathname);

    const loc = state.locationState.address;

    if (loc) {
      dispatch(fetchAllIssues(loc))
      .then(() => {
        setLocationFetchType(LocationFetchType.CACHED_ADDRESS);
      });
    } else {
      dispatch(fetchBrowserGeolocation());
    }
    dispatch(fetchCallCount());
  };
};